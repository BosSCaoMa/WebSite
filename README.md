# WebSite
```text
浏览器(用户)
    |
    | 访问 http://你的服务器/
    v
Nginx
  - /         -> 返回静态网页 (HTML/JS/CSS)
  - /api/...  -> 反向代理到 127.0.0.1:9000 (你的 C++ 服务)
                      |
                      v
                 C++ 程序(HTTP 服务)

```



# 前端

```bash
fetch('/api/hello?...')
   ↓
浏览器发 HTTP 到 80
   ↓
Nginx 收到 /api/... 请求
   ↓
Nginx 转发到 9000
   ↓
C++ 返回
   ↓
Nginx 再转给浏览器
```

## 浏览器到底发了什么给后端？（HTTP 报文）

以这句为例：

```js
fetch(`/api/hello?name=Kim`)
```

浏览器会发类似这样的 HTTP 请求：

```
GET /api/hello?name=Kim HTTP/1.1
Host: 你的域名或IP
User-Agent: ...
Accept: */*
Connection: keep-alive

（空行）
（GET 没有 body）
```

你的 C++ 服务器 `read()` 到的就是这一坨文本（Nginx转发后的）。

