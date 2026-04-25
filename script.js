const logEl = document.getElementById("log");
const SETTINGS_KEY = "temple_support_settings";

const formConfigs = [
  { id: "household-form", eventType: "UPSERT_HOUSEHOLD" },
  { id: "deceased-form", eventType: "REGISTER_DECEASED" },
  { id: "service-form", eventType: "REGISTER_MEMORIAL_SERVICE" },
  { id: "expense-form", eventType: "REGISTER_EXPENSE" }
];

function nowIso() {
  return new Date().toISOString();
}

function getSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeLog(title, payload, response) {
  const lines = [
    `\n[${new Date().toLocaleString("ja-JP")}] ${title}`,
    "payload:",
    JSON.stringify(payload, null, 2)
  ];

  if (response) {
    lines.push("response:");
    lines.push(JSON.stringify(response, null, 2));
  }

  logEl.textContent = `${lines.join("\n")}\n${logEl.textContent}`;
}

function toObject(form) {
  const data = new FormData(form);
  return Object.fromEntries(data.entries());
}

async function postToGoogleSheets(payload) {
  const settings = getSettings();
  if (!settings.webhookUrl) {
    return { skipped: true, reason: "Webhook URL未設定" };
  }

  const res = await fetch(settings.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  return {
    ok: res.ok,
    status: res.status,
    body: text
  };
}

formConfigs.forEach(({ id, eventType }) => {
  const form = document.getElementById(id);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      eventType,
      submittedAt: nowIso(),
      data: toObject(form)
    };

    try {
      const result = await postToGoogleSheets(payload);
      writeLog(`${eventType} 送信`, payload, result);
      form.reset();
    } catch (error) {
      writeLog(`${eventType} エラー`, payload, { message: String(error) });
    }
  });
});

const settingsForm = document.getElementById("settings-form");
settingsForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const values = toObject(settingsForm);
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(values));
  writeLog("設定保存", values, { ok: true });
});

const initial = getSettings();
if (initial.webhookUrl) {
  settingsForm.elements.webhookUrl.value = initial.webhookUrl;
}

writeLog("初期化完了", { message: "フォーム入力を開始できます" });
