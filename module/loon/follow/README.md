# 使用说明

1. 用电脑或者iPad登录网页版 https://app.follow.is/ iPhone用户需要横屏并缩小网页显示比例才能看到登录页面；
2. 抓包获取https://api.follow.is/wallets/transactions/claim-check的请求头内容，由于Loon支持MitM over HTTP/2，所以Cookie字段会有三个，需要特别注意；
3. 分别复制cookie字段中的值；
4. csrfToken的值是cookie: authjs.csrf-token=后面的一串数字和字母的内容，如0c1dd0526dd1436373bad402e07298ad4570623e6a80f7f67a3aa269e07b66c3%7C303f0186a007270b45241d557a2cd8abacbe7037ee025076294a7c9ea64e9054；

5. Cookie的值是authjs.session-token=xxx-xxxx-xxxx，如authjs.session-token=65u7ed9f-0a1f-4341-b1be-4cce07e82204；
6. 将获得的csrfToken和Cookie值按照上面的例子填写到此插件的配置页面；
7. 默认每日凌晨一点执行签到。