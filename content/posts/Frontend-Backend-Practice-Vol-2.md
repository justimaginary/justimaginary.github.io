---
title: 前后端交互工程实践指南 (Vol.2：Nginx反向代理与部署)
date: 2026-04-03 20:00:00
categories: 
  - Tech
  - Tutorial
tags:
  - 前后端交互
  - Nginx
  - Go
---
本文档建立在Vol.1之上，还未完成Vol.1请先完成<a href="frontend-backend-practice-vol-1.html" target="_blank">Vol.1</a>。Vol.1文档中指出跨域问题有CORS与Nginx两种解决方案，本文档将介绍这里的Nginx反向代理解决方案。后端所用语言是Go，前端为html。本文会有概念与实操，按文档进行以获得最佳效果。



## 模块一：检查服务器权限

Step1:
SSH连接到服务器。

Step2:
遇到端口被占用，导致后端服务跑不起来的场景非常常见，下面以此为背景验证sudo权限。

1.查询8080端口是否有程序在占用：
```bash
sudo lsof -i :8080
```
此时可能会要求输入密码，输入按回车即可，若遗忘联系我。

2．查看输出

若无任何输出，则代表该端口没有被占用，若存在输出，记住`<pid>`，运行：
```bash
sudo kill -9 <pid>
```
强制结束任务。

若输出 `student is not in the sudoers file. This incident will be reported.` 表示当前用户无sudo权限，联系我。



## 模块二：Nginx介绍

首先需要明确的是，跨域是什么？如果不记得的话<a href="frontend-backend-practice-vol-1.html#CORS%E4%B8%8E%E8%B7%A8%E5%9F%9F" target="_blank">点击这里</a>，查看Vol.1的介绍。

**代理：** 可以简单理解为中间人。

* **正向代理（Forward Proxy）：** 比如使用的VPN。我们要访问海外服务器，但事实上直接连接是连不上的，所以要找个代理帮我们转发。而找的代理代表的是“我们（客户端）”。
* **反向代理（Reverse Proxy）：** 相对于正向代理是代理“我们”，反向代理就是代理“服务器”。

> **举个例子：**
> 浏览器运行在80端口，只有在直接访问 80 端口从后端拿数据才不是跨域，反向代理就是让浏览器以为是直接访问后端拿的数据，但它根本不知道 80 端口背后其实站着 Nginx。Nginx 收到请求后，转身在服务器内部悄悄跑去 8080 端口找 Go 后端拿数据，再交回给浏览器。

反向代理的基础逻辑如下，以下的端口与公网ip均只是举例：

1. 我们让 Nginx 站在最前面的 80 端口（Web 默认端口）当接待员。

2. 当在浏览器输入 `http://47.101.141.52/` 时，请求直接发给了 Nginx。

3. Nginx 看到是来要网页的，就去工作目录把前端文件拿给你。

4. 当在网页里点击按钮或存在后端逻辑时，前端向 `http://47.101.141.52/api/...` 发送获取数据的请求时，Nginx 接到请求，发现带有 `/api/` 路由 ，它就会悄悄在服务器内部敲开 7001 包厢的门，把 Go 后端处理好的数据拿出来，再交回给你的浏览器。

以下进入实操。



## 模块三：端口占用

在思考跨域这个问题，最开始肯定会想到，既然有严格的跨域限制，那为什么不能让前后端运行在同一个端口上呢，为什么要费尽心思来处理跨域问题，为了探讨这个问题，我们来做一个实验。

Step1:
使用python自带的简易前端模拟前端启动。

目前服务器公网IP `47.101.141.52`的默认80 端口运行着一个独立服务，不要去动它，这个服务的后端运行在7001端口，那我们现在尝试使用python在7001端口创建进程。

```bash
sudo python3 -m http.server 7001
```

观察输出。

<details>
<summary><strong>点击查看输出结果与原理解析</strong></summary>

会出现：
`OSError: [Errno 98] Address already in use`

这说明同一个端口是不能同时运行前后端的，为什么会这样呢？

打个比方，服务器是一栋大楼，端口号就是大楼里的房间号。一台服务器（一个 IP）可以同时运行很多程序，端口用来区分这些不同的服务 。但是，一个端口只能运行一个程序。此时某个后端已经把 7001 房间的门反锁了，前端服务根本进不去。

这个时候我们可以验证一下：
```bash
sudo lsof -i :7001
```
查看输出，绝对不允许kill这个任务！

既然物理上不能住在同一个房间，前端和后端就必须运行在不同的端口。而一旦运行在不同的端口，浏览器就会触发同源策略，拦截数据的交互。这就形成了一个死结。为了解开这个死结，我们需要引入 Nginx 。

</details>

<br>
接下来的模块示例均以Vol.1中的<a href="frontend-backend-practice-vol-1.html#%E6%A8%A1%E5%9D%97%E4%BA%94%EF%BC%9A%E5%89%8D%E5%90%8E%E7%AB%AF%E4%BA%A4%E4%BA%92%E5%AE%9E%E4%BE%8B2" target="_blank">前后端交互实例2</a>为例说明。



## 模块四：前后端代码配置

Step1:
建议目录结构
```text
go-demo1/
├── main.go
└── index.html
```

Step2:
前后端代码请参见Vol.1中的对应篇章，<a href="frontend-backend-practice-vol-1.html#%E6%A8%A1%E5%9D%97%E4%BA%94%EF%BC%9A%E5%89%8D%E5%90%8E%E7%AB%AF%E4%BA%A4%E4%BA%92%E5%AE%9E%E4%BE%8B2" target="_blank">点击这里回顾</a>。

Step3:

如果完整的看完了Vol.1，会发现我们需要修改代码。因为Vol.1中我们解决跨域的方法是使用CORS，现在我们改用Nginx，所以我们要对函数进行更改。

```go
func handleRequest(w http.ResponseWriter, r *http.Request) {
    fmt.Printf("收到来自 %s 的请求！\n", r.RemoteAddr) 
    
    // 注释掉这三行代码，去除CORS
    // w.Header().Set("Access-Control-Allow-Origin", "*")
    // w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
    // w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")

    // 后续代码不变
```

Step4:
根据前文连接服务器上传文件的方法，将main.go上传至服务器。



## 模块五：Nginx配置

服务器已经安装好Nginx，运行以下命令查看Nginx状态。
```bash
systemctl status nginx
```
若出现 `Active: active (running)`，则Nginx正在正常运行。

Step1:
建议目录结构
```text
zhy/go-demo1/
├── main.go
└── index.html
```

Step2:
查看Nginx配置文件。

Nginx使用配置文件运行，要在配置文件定义端口转发。这里我们使用vim编辑，当然也可以使用VS code编辑配置文件，配置文件位于服务器 `/www/server/nginx/conf` 下。

```bash
sudo vim /www/server/nginx/conf/nginx.conf
```

此时会出现文件编辑页面，使用箭头移动光标，找到：

```nginx
server
    {
        listen 888;
        server_name phpmyadmin;
        index index.html index.htm index.php;
        root  /www/server/phpmyadmin;

        #error_page   404   /404.html;
        include enable-php.conf;

        location ~ .*\.(gif|jpg|jpeg|png|bmp|swf)$
        {
            expires      30d;
        }

        location ~ .*\.(js|css)?$
        {
            expires      12h;
        }

        location ~ /\.
        {
            deny all;
        }

        access_log  /www/wwwlogs/access.log;
    }
```

这是Nginx的默认配置，我们发现此时Nginx转发了888端口，我们在浏览器打开 <a href="http://47.101.141.52:888/" target="_blank">`http://47.101.141.52:888/`</a> ，会看到浏览器显示404 NOT FOUND，Nginx。接下来我们将修改这个默认配置，使其适应我们在Vol.1做的go-demo1。

Step3:
使用vim修改nginx.conf，以下给出vim的简易操作指南。

* vim分为<strong>普通模式</strong>与<strong>插入模式</strong>，进入文件默认以<strong>普通模式</strong>进入，按 `i` 切换至插入模式，插入模式下就是正常文件编辑器，只能使用键盘完成，按 `esc` 切回普通模式。
* 在<strong>普通模式</strong>下，按 `i` 切换至插入模式，在光标当前位置插入文本。
* 在<strong>普通模式</strong>下，输入 `:wq` 为保存并推出，`:q!` 强制退出但不保存。（输入完后要按回车，冒号不要忘了）
* 在<strong>普通模式</strong>下，按 `u` 为撤销上一步，`ctrl+r` 为重做。
* 在<strong>普通模式</strong>下，按 `x` 为删除当前文本，按 `dd` 为删除一整行，按 `ndd`（将n替换为具体数字，例如3dd）为删除光标向下数的n行。
* 在<strong>普通模式</strong>下，按 `yy` 复制光标当前一行，按 `p` 复制在光标的下一行。
* 在<strong>普通模式</strong>下，使用箭头或 `hjkl` 移动光标。

将以下内容修改

```nginx
        listen 888;
        server_name phpmyadmin;
        index index.html index.htm index.php;
        root  /www/server/phpmyadmin;

        #error_page   404   /404.html;
        include enable-php.conf;
```

为：

```nginx
        listen 888; 
        server_name goDemo1; 
        # 1. 托管前端：把根目录指向你的前端文件夹 
        root /home/zhy/go-demo1; 
        index index.html index.htm; 
        
        # 2. 反向代理：把发往 /api/ 的请求，偷偷转交给 8080 端口的 Go 后端 
        location /api/ { 
            proxy_pass [http://127.0.0.1:8080](http://127.0.0.1:8080);
        }
```

修改完成后按`esc`回到普通模式，输入 `:wq` 后回车，保存并退出。

Step4:
测试并重启Nginx。

```bash
sudo nginx -t
```
如果看到 `syntax is ok` 和 `test is successful` 的字样，说明配置非常正确，接着，让 Nginx 重新加载最新配置：

```bash
sudo nginx -s reload
```

Step5:

这个时候我们需要修改前端代码，因为前端此时和后端是通过Nginx代理同源访问的，但他不知道在8080端口存在着一个后端服务，他只知道在当前端口（888），直接就能拿到数据。

以下这句话需要修改，自行思考如何修改。

```javascript
const url = `http://${SERVER_IP}:8080/api/hello`;
```

<details>
<summary><strong>点击查看修改指导</strong></summary>

修改为：
```javascript
const url = `http://${SERVER_IP}:888/api/hello`;
```

</details>

<br>



以上，Nginx转发与前后端全部配置完成。

Step6:
打开服务器终端（bash）
启动后端服务

```bash
go run main.go
```
（此时任务还在进行，不要关闭终端。当测试结束后，输入ctrl+c，结束进程）

访问  <a href="http://47.101.141.52:888/" target="_blank">`http://47.101.141.52:888/`</a> ，查看使用Nginx代理部署到服务器上，属于你的第一个网站！

<br>

但这个时候，可能会出现问题，比如浏览器会显示 `403 Forbidden`。这是一个很常见的问题，我们回顾Nginx的配置文件，整个文件的第一句话是：

```nginx
user  www www;
```

这句话的意思是Nginx只拥有www权限，也就是普通用户权限，而你的文件夹 `/home/zhy/` 拒绝了www用户的访问，所以我们要为 `/home/zhy/` 赋予执行权限。

```bash
chmod 755 /home/zhy
```

并且让www用户拥有访问文件夹下文件的只读的权限。

```bash
chmod -R 755 /home/zhy/go-demo1
```

刷新网站，403即会消失！

祝贺你掌握了现代Web技术中最核心的内容。


---
END
