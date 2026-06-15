---
title: 从零手写 BiLSTM-CRF 分词方法
date: 2026-04-05 18:00:00
categories: 
  - Tech
  - NLP
tags:
  - PyTorch
  - 深度学习
  - BiLSTM-CRF
mathjax: true
math: true
sticky: 100
---
> This article is also available in English.
> [Read this article in English](bilstm-crf-from-scratch-en.html)

---

中文分词是自然语言处理（NLP）的基石。依托于中文信息处理课程，我准备完全不依赖诸如 CRF++ 或任何高级分词 API，基于 PyTorch 从零开始手写一个底层支持张量并行计算的 BiLSTM-CRF 模型。

并且最终，这个纯随机初始化的初始模型，在 SIGHAN PKU（第二届分词竞赛 北京大学）标准测试集上，达到了 **91.0% 的 F1 分数**。

这篇文章记录了整个项目从理论到代码落地的全过程。



## 一、 将语言转化为数学
计算机看不懂汉字，它只认识数字。所以在将文本喂给模型之前，我们需要跨越的第一步是将其“数字化”。

### 1. 词嵌入（Word Embedding）
最直白的数字化方法是给每个字编个号，比如“北”是 1，“京”是 2。但这种编号缺乏数学意义，1 和 2 之间并没有什么逻辑关联。

在 自然语言处理（NLP） 中，我们使用 **词嵌入（Embedding）** 技术。它的核心思想是把每一个汉字映射成一个多维的浮点数向量（Vector）。你可以把它想象成一个高维空间中的坐标点。而意思相近或经常搭配的字，在这个空间里的距离会比较近。

在 PyTorch 中，实现这一点只需要一行代码：
```python
# vocabSize 是词表大小，embeddingDim 是向量的维度（例如 128维）
self.wordEmbeds = nn.Embedding(vocabSize, embeddingDim)
```

### 2. 序列建模
传统的神经网络处理输入时是孤立的，但人类语言是一个序列。比如“斯”字，在“俄罗斯”和“斯文”中，分词的切分方式完全不同。

我们需要一个能“记住上下文”的模型，而 **LSTM（长短期记忆网络）** 就是为了解决序列记忆问题而生的。于是我们在中文分词选用了它，在 PyTorch 中，我们只需要一行代码：
```python
# hiddenDim 是 LSTM 的隐藏层维度，也就是它的“脑容量”
self.lstm = nn.LSTM(embeddingDim, hiddenDim // 2, num_layers=2, bidirectional=True, batch_first=True)
```


#### **1. 那我们如何训练LSTM里的参数，使其能够预测每个字的得分情况呢？**

当写下上面那行使用LSTM的代码时，LSTM 内部瞬间生成了成千上万个权重参数。一开始，它们全都是毫无意义的随机乱码。模型之所以能变聪明，全靠一套闭环的特训机制：

* **猜测（前向传播）**：模型先用这些随机数算出一个分词结果。
* **对答案（计算 Loss）**：把猜的结果和标准答案比对，算出误差。
* **找原因（反向传播）**：顺着计算图往回推，看看是哪个权重导致了误差。
* **微调（优化器）**：优化器根据学习率调整相关权重。


经过几万个 Batch 的反复训练，这些原本的随机数，最终固化成了能精准提取中文语法的“经验值”。

阅读完以上内容，你可能会产生疑惑，我们到底在训练什么，我们的目标是得到什么？接下来我将解答这个疑问

首先我们先说明我们的标注方式：

在这里，我们使用 **4-tag** 的方式标注，即将字分为4类，`S`表示单字，`B`表示 **词首** ，`M`表示 **词中** ，`E`表示 **词尾**。
例如对句子`“我是一名程序员。”`中每个字的类别，即：
```txt
我/S 是/S 一/B 名/E 程/B 序/M 员/E。/S
我 / 是 /  一名 / 程序员 / 。 
```

弄清楚怎样标注后，我们就想通过LSTM获得这个字最可能的标注，于是就想到能不能让LSTM生成一张得分表。

事实上我们也就是这样做的，在经过 BiLSTM 网络的深层特征提取后，原本独立的汉字向量已经融合了整句话的上下文信息，变成了包含了过去与未来视野的高维隐状态向量。为了把这个抽象的向量变成我们需要的得分，我们在 LSTM 后面接上了一个 **线性层（nn.Linear）** 。

这个线性层就像一个压缩机，把高维特征强行映射成对应标签的分数集合。比如当网络读到“程”字时，它可能会输出这样一张得分表：
```txt
B（词首）: 5.8
M（词中）: 1.2
E（词尾）: -2.3
S（单字）: -0.5
```
在这张表里，LSTM 强烈认为“程”字是一个词的开头（得分为 5.8）。这种分数在学术上被称为发射分（Emission Score）。但我们能不能就此使用这个最高的分值作为这个字的标签呢？答案是否定的，具体为什么，我们在后续介绍。


现在我们已经理解使用LSTM到底是为了生成什么，在进行下一步之前，我觉得有必要**介绍一下LSTM简要的运行模式：**

#### **2. 双线操作：长期记忆与短期记忆**
如果你看过 LSTM 的内部结构图，会发现信息在里面分成了两条线在跑，这也是它区别于普通RNN（循环神经网络）的地方，我们在这里只粗略展示了一下细节：

* **细胞状态（Cell State / 长期记忆）**：这是贯穿 LSTM 内部的一条道路。它的信息流动非常平稳，只进行简单的加法和乘法。这使得即使是很久以前读到的词，其语境信息也能顺着传送带一直往后传，完美解决了传统神经网络容易“健忘”的缺陷。这条线是 LSTM 的内部机密，不对外公开。

* **隐藏状态（Hidden State / 短期记忆）**：这是 LSTM 主要的输出通道。当 LSTM 读完当前这个字后，它会审视一下自己的“长期记忆”，然后结合当前刚读进来的字，决定提取哪些信息作为最终结论。

在网络运行预测的时候，我们会在代码里接收到 `lstmOut`：
```python
lstmOut, _ = self.lstm(embeds)
```
这个 `lstmOut`，拿到的全都是“短期记忆”（隐藏状态）。它是 LSTM 综合了全局的长期记忆后，向上层网络（全连接层和 CRF）交出的最终答卷。

为了让模型既能看上文，也能看下文，我们开启了 `bidirectional=True`。这样，我们就有了一正一反两个 LSTM ，组成了一个BiLSTM，BiLSTM会把各自的结论拼在一起，给每个字输出一个包含完整上下文状态的矩阵。



## 二、 我们为什么需要CRF？

如果 BiLSTM 已经能给每个字打分了，为什么我们不直接选分数最高的那个标签？

因为语言有其固定的组合规则。在 BMES 标注体系中， `B ` 后面只能接  `M ` 或  `E `，绝对不可能直接接  `B ` 或  `S `。BiLSTM 虽然能结合上下文，但它在最终输出标签时，每个字依然是独立决策的，它偶尔会犯“语法错误”。

这时候就需要 **条件随机场（CRF）** 出场了。CRF 的本质是一张转移概率矩阵（Transition Matrix）。它记录了从一个标签转移到另一个标签的合理性得分。

模型最终选择的路径得分，是由 LSTM 给出的状态分加上 CRF 给出的转移分共同决定的。LSTM 负责提交一张“意向打分表”（发射分），而 CRF 则拿着语法规则进行“全局统筹”（转移分）。

它们在数学上是如何完美融合的？这可以用条件随机场最核心的条件概率公式来表达 ：

$$
\begin{aligned}
P(y|x) &= \frac{1}{Z(x)} \exp\left(\sum_{i,k} \lambda_k t_k(y_{i-1}, y_i, x, i) + \sum_{i,j} \mu_j s_j(y_i, x, i)\right) \\
Z(x) &= \sum_{y} \exp\left(\sum_{i,k} \lambda_k t_k(y_{i-1}, y_i, x, i) + \sum_{i,j} \mu_j s_j(y_i, x, i)\right)
\end{aligned}
$$

我们把它当成一个简单的“路线打分系统”来看待。

公式里的 $x$ 是我们输入的句子（比如“北京大学”），$y$ 是我们要评估的分词标签路线（比如  `B-E-B-E `） 。这个公式其实就在算：在看到句子 $x$ 时，这条特定路线 $y$ 是正确答案的概率 $P(y|x)$ 是多少。

看公式括号里被加号分开的两部分：

* **后半部分 $\sum_{i,j} \mu_j s_j(y_i, x, i)$**：这是 **LSTM 的状态分（发射特征）** 。它在算“单看每个字，把它标成对应标签能得多少分” 。
* **前半部分 $\sum_{i,k} \lambda_k t_k(y_{i-1}, y_i, x, i)$**：这是 **CRF 的转移分（转移特征）** 。它在算“从上一个标签 $y_{i-1}$ 跨步到当前标签 $y_i$，这个动作符合语法规矩吗？能得多少分” 。

把这两部分加起来，就是这条分词路线的 **绝对总分**。但绝对分数没法直接代表概率（比如 100 分和 1000 分），我们需要把它变成百分比。这就引出了公式里的另外两个操作：

1. **$\exp()$ 函数**：把所有可能为负数的原始得分，强行转换成正数，方便后续做除法。

2. **除以 $Z(x)$**：$Z(x)$ 有一个名字叫 **配分函数（Partition Function）**。看它的展开式就能发现，它其实就是**把所有可能存在的分词路线（哪怕是错得离谱的路线）的得分全部累加起来**。

所以，这个看似复杂的概率公式，本质上就是一句话：

> **这条路线的概率 = 这条路线的得分 / 所有可能路线的总得分。** 模型训练的目标，就是不断调整参数，让正确路线的概率无限逼近于 1。


在代码中，转移矩阵被定义为一个可学习的参数：
```python
# tagsetSize 是标签的数量（BMES + START + STOP 共 6 个）
self.transitions = nn.Parameter(torch.randn(self.tagsetSize, self.tagsetSize))

# 强行加入规则约束：任何标签都不能转移到 START，STOP 也不可能转移到其他标签
self.transitions.data[tagToIx["<START>"], :] = -1000000
self.transitions.data[:, tagToIx["<STOP>"]] = -1000000
```



## 三、 张量广播与并行计算

这个项目中最具挑战性的部分是如何在 PyTorch 中手写 CRF 的计算逻辑。

尤其是上面公式里的那个 $Z(x)$，要穷举一条句子里所有可能的路线，计算量是指数级的。如果使用原生的 Python `for 循环`一句一句地计算（Batch Size = 1），在动辄几十万句的训练集面前，GPU 大量的时间都会浪费在等待 CPU 发射指令上。真正的提速，必须依赖张量的维度变换与 **广播机制（Broadcasting）**。

### 1. 动态生成掩码（Mask）
为了让不同长度的句子能拼成一个规整的矩阵（Batch）放进 GPU，我们用 0 作为填充符补齐了短句。但这会带来新问题：CRF 会把这些 0 也当成汉字进行计算，导致模型学到错误的语法。

我们需要动态生成一个 Mask 矩阵，告诉模型哪些是真实的字，哪些是填充物。
```python
# sentences 形状: [batch_size, seq_len]
mask = (sentences != 0).to(device)
```

### 2. 重构前向算法（Forward Algorithm）
CRF 训练时需要计算一条真实路径在所有可能路径中的概率（Softmax）。计算“所有可能路径的总得分”也就是计算公式中的 $Z(x)$，这就是著名的前向算法。利用 3D 张量的广播机制，我们可以在不写任何标签级 `for 循环`的情况下，瞬间完成整个 Batch 的状态揉合：

```python
def forwardAlg(self, feats, mask):
    batch_size, seq_len, _ = feats.shape
    
    # 初始化记分牌
    forwardVar = torch.full((batch_size, self.tagsetSize), -1000000.0, device=feats.device)
    forwardVar[:, self.tagToIx["<START>"]] = 0.
    
    for t in range(seq_len):
        feat = feats[:, t, :]  # 当前时刻的意向分: [batch_size, num_tags]
        mask_t = mask[:, t].unsqueeze(1)
        
        # 核心张量广播机制
        # forwardVar.unsqueeze(1): 上一步的标签 j
        # self.transitions: 从 j 到 i 的转移矩阵
        # feat.unsqueeze(2): 当前步的标签 i
        tagVar = forwardVar.unsqueeze(1) + self.transitions + feat.unsqueeze(2)
        
        # 沿着上一时刻的维度（dim=2）求 logsumexp
        next_forwardVar = torch.logsumexp(tagVar, dim=2)
        
        # 掩码拦截：遇到 PAD 则保留上一步的分数
        forwardVar = torch.where(mask_t == 1, next_forwardVar, forwardVar)
        
    terminalVar = forwardVar + self.transitions[self.tagToIx["<STOP>"]]
    return torch.logsumexp(terminalVar, dim=1)
```

这段代码的难点在于理解 `unsqueeze` 的维度对齐。PyTorch 的底层 C++ 算子会根据维度自动扩展矩阵并执行加法，这使得计算速度获得了数十倍的提升。



## 四、 超参数与泛化

在解决了并行计算的工程瓶颈后，模型的分数一度卡在 89% 左右。为了突破 90% 的大关，并在没有外部知识库（如预训练 Word2Vec）的情况下进一步提升泛化能力，我在训练流中加入了三个关键机制。

### 1. 引入 Dropout 打破共适应
LSTM 如果参数量过大，极易对训练集死记硬背。我们在 LSTM 之后加入了一层 `nn.Dropout(0.5)`。它会在每次前向传播时，随机屏蔽 50% 的神经元。这逼迫模型不能依赖个别特征，而是去学习更为全局和本质的汉字组合规律。加入这一机制后，模型对未登录词（生词）的召回率大幅提升。

### 2. L2 正则化（Weight Decay）
在优化器中加入微小的惩罚项，抑制异常膨胀的权重参数，使模型在决策时更加平滑和克制。
```python
optimizer = optim.Adam(model.parameters(), lr=0.001, weight_decay=1e-5)
```

### 3. 动态学习率调度
使用 `ReduceLROnPlateau` 实时监控验证集的 Loss。当模型陷入平台期时，自动缩小学习率，帮助模型在损失函数的“碗底”收敛到最精准的全局最优解。



## 五、 写在最后

Follow curiosity and passion, not trends.

Life is surprisingly short, so solve problems that interest and excite you most


---
END
