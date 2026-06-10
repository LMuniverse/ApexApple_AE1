const KEY = "claude_clear_stale_session_step_v13";

const body = JSON.stringify({
  type: "error",
  error: {
    type: "session_expired",
    message: "Session expired"
  }
});

let step = "1";

try {
  const saved = $persistentStore.read(KEY);
  if (saved === "2") {
    step = "2";
  }
} catch (e) {
  step = "1";
}

let cookieToClear = "";
let nextStep = "";

if (step === "1") {
  cookieToClear =
    "sessionKey=; Path=/; Domain=.claude.ai; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; Secure; HttpOnly; SameSite=Lax";
  nextStep = "2";

  try {
    $persistentStore.write("2", KEY);
  } catch (e) {}

  try {
    $notification.post(
      "Claude Clear V13-AutoTwoStep",
      "第 1 步：清理 sessionKey",
      "已返回 401 session_expired；下一次命中会清理 routingHint"
    );
  } catch (e) {}
} else {
  cookieToClear =
    "routingHint=; Path=/; Domain=.claude.ai; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; Secure; HttpOnly; SameSite=Lax";
  nextStep = "1";

  try {
    $persistentStore.write("1", KEY);
  } catch (e) {}

  try {
    $notification.post(
      "Claude Clear V13-AutoTwoStep",
      "第 2 步：清理 routingHint",
      "已返回 401 session_expired；如果出现登录页，请立刻关闭插件"
    );
  } catch (e) {}
}

$done({
  response: {
    status: 401,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Set-Cookie": cookieToClear
    },
    body: body
  }
});