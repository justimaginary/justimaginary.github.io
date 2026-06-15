---
title: 前后端交互工程实践指南 (Vol.1：入门与基础)
date: 2026-03-30 22:30:00
categories: 
  - Tech
  - Tutorial
tags:
  - 前后端交互
  - Go
  - Cpp
---
本文档介绍了基本计算机网络中有关前后端交互的工程实践，考虑到cpp并非好的后端语言，这里后端所用语言是Go，前端为html。附录中会给出使用cpp作为后端语言进行前后端交互的例子，本文会有概念与实操，按文档进行以获得最佳效果。

---

本文档前后端最终交互内容：

前端显示一个页面，提示输入一个整数。等待输入后将整数返回后端，根据映射表，后端返回内容给前端，前端再将其输出。

映射表：

| 输入 | 输出 |
| :--- | :--- | 
|  非整数 |  Num必须是整数 |
|  整数 |  2*整数+1 |



## 模块一：前后端交互简要介绍

### 简介
首先需要明确的是，前后端交互的三个流程是**请求，处理与响应**。即前端（也就是浏览器网页），向后端服务器（也就是使用代码写的一个程序）发送一个请求，后端服务器接受后进行处理，处理完后会返回内容给前端（这一过程就是响应）。

> **打一个比喻：**
> 我们一直写的程序的输入依靠的是文件或者控制台输入，输出是文件或者控制台输出，前后端交互就是输入为前端发送来的请求，输出为返回给前端的内容，**相当于后端为一个函数**。

### HTTP协议
在前后端交互中，HTTP（Hypertext Transfer Protocol）协议是最常用的协议之一。HTTP是一种应用层协议，用于在Web应用程序之间传输数据。它定义了客户端和服务器之间的通信规则和约定。

以下是HTTP协议的一些关键概念和要点：

* **请求和响应：** HTTP通信是通过请求和响应进行的。客户端发送HTTP请求给服务器，服务器处理请求并返回HTTP响应给客户端。
* **方法：** HTTP定义了几种请求方法，常见的有GET、POST、PUT、DELETE等。不同的方法用于执行不同的操作，如获取资源、提交数据、更新资源和删除资源。
* **URL：** URL（Uniform Resource Locator）用于标识要访问的资源的位置。它由协议类型、服务器地址、路径和可选的查询参数组成。

---

* **请求头：** HTTP请求包括一个请求头，用于传递关于请求的元数据，如请求的方法、请求的资源、请求的内容类型等。
* **请求体：** 某些请求，如POST请求，可以包含请求体。请求体用于传递数据给服务器，如表单数据、JSON数据等。
#### 实例演示：用户登录场景

##### 完整的 HTTP 请求报文 (Request)
```http
POST /api/login HTTP/1.1
Host: 47.101.141.52:8080
Content-Type: application/json
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)

{"username": "zhangsan", "password": "123"}
```

* **请求解析**：
    * **方法与 URL**：使用了 `POST` 方法，目标路径是 `/api/login`。
    * **请求头**：从第一行 `POST /api/login` 开始，到 `User-Agent: ...` 结束的所有行。它们描述了“我是谁”以及“我要发什么”。其中`Content-Type: application/json` 告诉后端，接下来的请求体里装的是 JSON 格式的数据。
    * **请求体**：在空行之后，包含了真正的业务数据 `{"username": "zhangsan", ...}`。
    
---

* **响应状态码：** HTTP响应包括一个状态码，用于指示请求的处理结果。常见的状态码有200表示成功，404表示资源未找到，500表示服务器内部错误等。
* **响应头：** HTTP响应还包括响应头，用于传递关于响应的元数据，如响应的内容类型、响应的长度等。
* **响应体：** 响应体是服务器返回给客户端的实际数据内容，可以是HTML、JSON、图片等不同类型的数据。

#### 实例演示：用户登录场景
##### 完整的 HTTP 响应报文 (Response)
```http
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 46
Set-Cookie: session_id=xyz987; Path=/

{"message": "登录成功", "token": "abcde123"}
```

* **响应解析**：
    * **响应状态码**：`200 OK` 明确告诉前端，这次登录逻辑在后端跑通了。
    * **响应头**：从第一行 `HTTP/1.1 200 OK` 开始，到 `Set-Cookie: ...` 结束的所有行。**响应头是可以由后端开发者在代码中自定义的**。
    * **功能说明**：`Set-Cookie` 是后端发给前端的“通行证”。由于 HTTP 是“无状态”的，服务器通过在响应头里自定义这个字段，要求浏览器存下信息。当浏览器下次发起请求时会自动带上它，从而让服务器识别出用户。
    * **响应体**：返回了 JSON 格式的成功消息和 Token，前端 JavaScript 拿到后会据此执行页面跳转。
    
> **小贴士**：你会发现请求头/响应头与 Body 之间都有一个**空行**，那是协议规定的“分界线”，没有它，程序就不知道哪里是信封，哪里是信件内容。

---

* **Cookie和Session：** HTTP协议支持使用Cookie和Session来维持状态。服务器可以通过在响应中设置Cookie来存储一些客户端状态信息，客户端将Cookie保存并在后续请求中发送给服务器。

> **值得注意的是：**
> HTTP协议是一种无状态协议，也就是每一个请求与响应之间是独立的，服务器并不会保留客户端的状态信息。举个例子，对于一个登录界面，前端发送登录请求，后端在验证凭据合法后虽然允许了访问，但由于 HTTP 协议的无状态特性，服务器并不会在内存中记住这位用户，但开发者可能会通过服务端手动实现记忆。这意味着，当用户发起第二次请求（比如查看个人订单）时，服务器依然会把用户当成陌生人，要求你重新证明身份。解决方案就是使用Cookie、token等。

### WebSocket协议
WebSocket协议是一种双向的通信协议，他允许在客户端和服务器之间建立持久的连接并进行实时双向通信，相对于HTTP请求，WebSocket提供了更低的延迟与更好的性能，所以我的机器人Nina就也采用了WebSocket协议，用于实时接受消息并处理。

HTTP协议与WebSocket协议的主要区别是，HTTP协议必须每次由前端请求，后端才能产生响应；而WebSocket协议是前后端一次握手（成功连接，这一过程通过HTTP协议）后，前后端可以任意向对方发送消息，直到主动断开连接，后端不再依赖前端的请求。

### 核心术语
* **API：** 接口，也就是前端调用接口来实现交互，可以理解为一个函数，调用函数返回内容。
* **JSON：** 前后端交互的主要语言，一种数据格式。
* **端口：** 一台服务器（一个 IP）可以同时运行很多程序（比如网站、数据库）。端口用来区分这些不同的服务。一个端口只能运行一个程序。
* **路由：** 可以理解为函数名。路由的组成：URL 中域名/端口之后的部分。
    * `https://api.shop.com:8080/users` --> `/users` 就是路由。
    * `https://api.shop.com:8080/products` --> `/products` 是另一个路由。
* **后端路由：** 服务器根据不同的路径，调用不同的函数。看到 `/login`，去跑登录的代码。看到 `/get_order`，去跑查询订单的代码。


### CORS与跨域
浏览器有一个基本安全原则：同源策略。它规定，默认情况下，只有当“协议、域名、端口”三者完全一致时，浏览器才允许前端脚本去读取另一个地址的数据。

举几个例子：

| 场景 | 是否跨域 | 原因 |
| :--- | :--- | :--- |
| `http://a.com` -> `http://a.com/api` | 否 | 协议、域名、端口都一样 |
| `http://a.com` -> `https://a.com` | 是 | 协议不同 (http vs https) |
| `http://a.com` -> `http://b.com` | 是 | 域名不同 (a vs b) |
| `http://a.com:8080` -> `http://a.com:3000` | 是 | 端口不同 (8080 vs 3000) |

> **为什么要有这个限制？**
> 举个例子：如果登录了网银（bank.com），同时也打开了一个恶意网站（evil.com）。如果没有同源策略，evil.com 里的脚本就能轻而易举地读取你网银的登录信息或余额。

值得注意的是产生了跨域并不意味着后端没有收到请求，事实是，对于简单请求，后端收到请求也返回给了前端，但前端的载体浏览器发现，后端并没有批准跨域，所以拒绝了数据并报错。但对于自定义头与POST（JSON）等的复杂请求，浏览器会发送OPTIONS预检请求，若预检不通过则不会发送业务请求。

目前的主流解决方案有CORS与Nginx反向代理，本文只介绍CORS，Nginx反向代理后续介绍。

CORS其实非常简单，CORS (Cross-Origin Resource Sharing)，即跨域资源共享。它做的就是要求后端在响应头里加一张“通行证”：
`Access-Control-Allow-Origin: *` (允许所有人) 或 `http://your-frontend.com` (只允许你的前端)。

### 完整的交互流程
1. 前端与用户产生交互，需要发送请求
2. 定位IP与端口（API服务的地方）
3. 向后端传递请求，请求中会包含路由
4. 后端根据不同的路由调用不同的函数，返回响应

<br>
以上只是比较基础的前后端交互的概念与流程，更深层的TCP等协议都未做介绍，以下进入实操。



## 模块二：连接云服务器

参见连接服务器文档



## 模块三：前后端交互实例1:

Step1:
建议目录结构
```text
cpp-demo/
├── main.cpp
├── httplib.h
└── index.html
```

Step2:
编写后端代码
```cpp
#include "httplib.h"
#include <iostream>

using namespace httplib;

int main() {
    Server svr;

    // 1. 静态文件路由：访问 http://localhost:8080 时返回当前的 index.html
    svr.Get("/", [](const Request& /*req*/, Response& res) {
        res.set_content("<html><body><h1>Loading...</h1><script>location.href='/index.html'</script></body></html>", "text/html");
    });

    // 允许服务器读取当前文件夹下的静态文件 (如 index.html)
    svr.set_mount_point("/", "./");

    // 2. API 路由：处理前端发来的数据
    svr.Get("/api/greet", [](const Request& req, Response& res) {
        // 获取前端传来的参数 "name"
        std::string name = req.get_param_value("name");
        if (name.empty()) name = "陌生人";

        std::string json_data = "{\"message\": \"你好 " + name + "，这是来自 C++ 后端的回复！\"}";
        
        // 设置跨域头（如果本地直接双击打开 HTML 需要这个）
        res.set_header("Access-Control-Allow-Origin", "*");
        res.set_content(json_data, "application/json");
        
        std::cout << "收到请求，名字是: " << name << std::endl;
    });

    std::cout << "C++ 后端已启动：http://localhost:8080" << std::endl;
    svr.listen("0.0.0.0", 8080);

    return 0;
}
```

Step3:
编写前端代码
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>C++ 前后端交互</title>
</head>
<body style="text-align: center; padding-top: 50px; font-family: sans-serif;">
    <h2>C++ 本地交互演示</h2>
    <input type="text" id="nameInput" placeholder="输入你的名字">
    <button onclick="sendToCpp()">发送给 C++</button>
    
    <p id="response" style="color: blue; margin-top: 20px;"></p>

    <script>
        async function sendToCpp() {
            const name = document.getElementById('nameInput').value;
            // 请求 C++ 开启的 8080 端口
            const res = await fetch(`http://localhost:8080/api/greet?name=${name}`);
            const data = await res.json();
            document.getElementById('response').innerText = data.message;
        }
    </script>
</body>
</html>

```

Step4:

访问[https://raw.githubusercontent.com/yhirose/cpp-httplib/master/httplib.h](https://raw.githubusercontent.com/yhirose/cpp-httplib/master/httplib.h) ，下载httplib.h，并参考Step1放置在文件夹内。

Step5:

点击开始菜单，搜索“Developer Command Prompt for VS 2022”（注：建立在大家高程使用的vs2022上）
打开命令窗口
```cmdForVS2022
where cl
```

若输出类似
```cmdForVS2022
C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Tools\MSVC\<version>\bin\Hostx64\x64\cl.exe
```
就可以执行编译命令（并非使用g++编译）
```cmdForVS2022
cl /EHsc /utf-8 main.cpp ws2_32.lib /Fe:myserver.exe
myserver.exe
```

（此时任务还在进行，不要关闭终端。当测试结束后，输入ctrl+c，结束进程）

编译可能会遇到很多问题，编码语言请使用UTF-8，否则前端会出现乱码，若变更前端字符代码，则后端编译删去/utf-8，这是我找到的比较好的解决方案，这再次印证了c++并不是一门好的后端语言。

Step6:
打开浏览器，进入 [http://localhost:8080](http://localhost:8080)

至此，已经完成了一个使用c++编写的前后端交互的程序。



## 模块四：DevTools使用指南:

Step1：一个挑战题！

密文使用Base64加密，网络上有很多解码器！

访问[http://47.101.141.52/](http://47.101.141.52/) ；来挑战一下吧！



## 模块五：前后端交互实例2:

Step1:
建议目录结构
```text
go-demo1/
├── main.go
└── index.html
```

Step2:
编写后端代码
```go
// 1. 告诉系统：这是一个可以独立运行的程序
package main

// 2. 导入工具箱：我们需要处理网络(http)、打印文字(fmt)和处理JSON数据(encoding/json)
import (
    "encoding/json"
    "fmt"
    "net/http"
)

// 3. 定义我们要接收和发送的数据格式
type Message struct {
    Name    string `json:"name"`  // 学生输入的名字
    Reply   string `json:"reply"` // 服务器回的内容
    Details string `json:"details"` //额外信息
}

func handleRequest(w http.ResponseWriter, r *http.Request) {
    fmt.Printf("收到来自 %s 的请求！\n", r.RemoteAddr)
    // 设置返回的内容格式为 JSON
    w.Header().Set("Content-Type", "application/json")

    // 如果是“预检请求”(OPTIONS)，直接返回成功
    if r.Method == "OPTIONS" {
       return
    }

    // 解析学生从前端传来的名字
    var received Message
    json.NewDecoder(r.Body).Decode(&received)

    // 准备要寄回给学生的数据
    sendBack := Message{
       Name:    received.Name,
       Reply:   "服务器已收到！你好 " + received.Name,
       Details: "这是从后端传来的额外详情信息。",
    }

    // 把数据变成 JSON 字符串发回给前端
    json.NewEncoder(w).Encode(sendBack)
}

func main() {
    // 设置“路标”：当访问 /api/hello 时，交给 handleRequest 函数处理
    http.HandleFunc("/api/hello", handleRequest)

    fmt.Println(">>> 后端服务已启动！监听端口: 8080")

    // 启动服务
    http.ListenAndServe(":8080", nil)
}

```

Step3:
编写前端代码
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>极简前后端交互实验</title>
    <style>
       body { font-family: 'PingFang SC', sans-serif; padding: 40px; background: #f5f5f5; line-height: 1.6; }
       .container { max-width: 600px; margin: 0 auto; background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
       input { padding: 10px; width: 70%; border: 1px solid #ddd; border-radius: 4px; }
       button { padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
       .box { margin-top: 20px; padding: 15px; border-radius: 6px; font-size: 13px; }
       .sent { background: #e8f0fe; border-left: 5px solid #1a73e8; }
       .response { background: #f8f9fa; border-left: 5px solid #343a40; color: #333; }
       .error { background: #fff1f0; border-left: 5px solid #ff4d4f; color: #cf1322; }
       h4 { margin-bottom: 5px; color: #666; }
       pre { white-space: pre-wrap; word-wrap: break-word; margin: 0; }
    </style>
</head>
<body>

<div class="container">
    <h3>第一步：输入你的名字</h3>
    <input type="text" id="userName" placeholder="比如：张三">
    <button onclick="startMission()">发起请求</button>

    <div id="requestPart" class="box sent" style="display:none">
       <h4>1. 发送的“数据包”实体：</h4>
       <pre id="sentJson"></pre>
    </div>

    <div id="responsePart" class="box response" style="display:none">
       <h4>2. 服务器返回的“全貌”（Raw Response）：</h4>
       <pre id="fullResponse"></pre>
       <hr>
       <h4>3. 最终提取的实际内容：</h4>
       <p id="finalMsg" style="color: green; font-weight: bold;"></p>
    </div>

    <div id="errorPart" class="box error" style="display:none">
       <h4>出错了！原因分析：</h4>
       <p id="errorMsg"></p>
    </div>
</div>

<script>
    const SERVER_IP = "47.101.141.52";

    async function startMission() {
       const name = document.getElementById('userName').value;
       const url = `http://${SERVER_IP}:8080/api/hello`;

       // 重置显示状态
       document.getElementById('requestPart').style.display = 'block';
       document.getElementById('responsePart').style.display = 'none';
       document.getElementById('errorPart').style.display = 'none';

       const payload = { name: name || "无名氏" };
       document.getElementById('sentJson').innerText = JSON.stringify(payload, null, 2);

       try {
          const response = await fetch(url, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify(payload)
          });

          // 如果代码运行到这里，说明请求成功了
          document.getElementById('responsePart').style.display = 'block';

          // 显示返回的完整状态
          const rawInfo = `状态码: ${response.status} ${response.statusText}\n内容类型: ${response.headers.get('Content-Type')}`;
          document.getElementById('fullResponse').innerText = rawInfo;

          // 显示实际内容
          const result = await response.json();
          document.getElementById('finalMsg').innerText = result.reply + "\n(" + result.details + ")";

       } catch (err) {
          // 如果出错了，显示错误
          document.getElementById('errorPart').style.display = 'block';
          document.getElementById('errorMsg').innerText =
                "无法连接到服务器。请打开devtools查看console与network两个板块：\n" +
                "1. 在console中查看是否存在红色报错，记录下报错\n" +
                "2. 打开network面板，查看hello的那条请求的状态码\n";

          console.error(err);
       }
    }
</script>

</body>
</html>

```

Step4:
根据上述连接服务器上传文件的方法，将main.go上传至服务器。

Step5:
打开服务器终端（bash）
启动后端服务
```bash
go run main.go
```
（此时任务还在进行，不要关闭终端。当测试结束后，输入ctrl+c，结束进程）

Step6:

双击index.html，查看是否能够完成交互，还是会报错。若报错可至devtools查看console与network栏查看报错消息与状态码。

思考为什么会报错。

<details>
<summary><strong>点击这里查看指导</strong></summary>
由于并没有处理跨域，所以浏览器拒绝了后端返回的数据！所以我们需要修改代码，使其接受跨域。

```go
func handleRequest(w http.ResponseWriter, r *http.Request) {
    fmt.Printf("收到来自 %s 的请求！\n", r.RemoteAddr) 
    // 加入这三行代码，表示允许所有访问
    w.Header().Set("Access-Control-Allow-Origin", "*")
    w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
    w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")

    // 后续代码不变
```

再跳转至Step4尝试，至此，已经完成现在业界使用主流后端语言go编写的第一个前后端交互！

</details>



## 模块六：前后端交互实例3:

前端显示一个页面，提示输入一个整数。等待输入后将整数返回后端，根据映射表，后端返回内容给前端，前端再将其输出。

映射表：

| 输入 | 输出 |
| :--- | :--- | 
|  非整数 |  Num必须是整数 |
|  整数 |  2*整数+1 |

Step1:
建议目录结构
```text
go-demo2/
├── main.go
└── index.html
```

Step2:
编写后端代码
```go
package main

import (
    "encoding/json"
    "fmt"
    "net/http"
    "strconv"
)

// Response 定义返回数据结构
type Response struct {
    Input  string      `json:"input"`  // 保持原始输入为字符串，方便展示
    Result interface{} `json:"result"` // 使用接口类型，使其能同时支持整数和字符串
}

func main() {
    http.HandleFunc("/api/calc", func(w http.ResponseWriter, r *http.Request) {
       // --- 【核心：增加跨域配置】 ---
       // 允许所有来源访问
       w.Header().Set("Access-Control-Allow-Origin", "*")
       // 允许的请求方法
       w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
       // 允许的请求头
       w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

       // 如果是预检请求 (OPTIONS)，直接返回
       if r.Method == "OPTIONS" {
          return
       }

       w.Header().Set("Content-Type", "application/json")

       // 获取参数
       numStr := r.URL.Query().Get("num")

       var resp Response
       resp.Input = numStr

       // 尝试转为整数
       num, err := strconv.Atoi(numStr)

       if err != nil {
          // 【映射表逻辑 1】：非整数
          resp.Result = "Num 必须是整数"
       } else {
          // 【映射表逻辑 2】：整数 -> 2 * n + 1
          resp.Result = 2*num + 1
       }

       // 返回 JSON
       json.NewEncoder(w).Encode(resp)
    })

    fmt.Println("服务启动在 :8080 端口...")
    http.ListenAndServe(":8080", nil)
}

```

Step3:
编写前端代码
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8"> <!-- 设置字符编码为 UTF-8 -->
    <title>2*num+1 计算</title> <!-- 页面标题 -->
</head>
<body>
<h3>整数映射计算器</h3>
<input type="text" id="numInput" placeholder="请输入内容">
<button onclick="calculate()">提交</button>

<div style="margin-top: 20px;">
    <p>输入内容：<span id="showInput"></span></p>
    <p>返回结果：<b id="showResult" style="color: blue;"></b></p>
</div>

<script>
    const SERVER_IP = "47.101.141.52";
    async function calculate() {
       const val = document.getElementById('numInput').value;
       // 调用后端接口
       const response = await fetch(`http://${SERVER_IP}:8080/api/calc?num=${val}`);
       const data = await response.json();

       document.getElementById('showInput').innerText = data.input;
       document.getElementById('showResult').innerText = data.result;
    }
</script>
</body>
</html>

```

Step4:
根据上述连接服务器上传文件的方法，将main.go上传至服务器。

Step5:
打开服务器终端（bash）
启动后端服务
```bash
go run main.go
```
（此时任务还在进行，不要关闭终端。当测试结束后，按ctrl+c，结束进程）

至此，已经完成本教程的全部内容，对前后端交互流程已有大致理解。以上go程序均为go原生http，并没有涉及到gin框架，框架后续介绍。工程上使用框架可以大幅降低代码量，常见的为go的gin框架与java的spring。

---

## 附录：
如果出现端口被占用怎么办，两种解决方案

A1:将后端服务端口换一个

A2:
```bash
sudo lsof -i :8080 #8080更改为被占用的那个端口
kill -9 <pid>
```

---
END
