const $ = (id) => document.getElementById(id);

// ===== 起動時：Closed Loopの学習状況バッジを表示 =====
(async function loadLoopBadge() {
  try {
    const res = await fetch(`${API_BASE}/api/stats`);
    const s = await res.json();
    const rate = s.upRate != null ? `／👍率 ${s.upRate}%` : "";
    $("loopBadge").textContent = `🔄 学習した知見：${s.knowledgeCount}件${rate}（運用するほど賢くなります）`;
  } catch (_) {
    $("loopBadge").textContent = "🔄 運用するほど賢くなる自己改善型AI";
  }
})();

$("runBtn").addEventListener("click", async () => {
  const domain = $("domain").value.trim();
  const keywords = $("keywords").value
    .split("\n")
    .map((k) => k.trim())
    .filter(Boolean);

  // ドメインは必須項目
  if (!domain) {
    $("status").innerHTML = `<span class="err">ドメインは必須です（例：example.com）</span>`;
    $("domain").focus();
    return;
  }
  if (keywords.length === 0) {
    $("status").innerHTML = `<span class="err">キーワードを入力してください。</span>`;
    $("keywords").focus();
    return;
  }

  $("status").textContent = "検索・構造分析中…";
  $("results").innerHTML = "";
  $("runBtn").disabled = true;

  try {
    const res = await fetch(`${API_BASE}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain, keywords }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    const remaining = data.quota.limit - data.quota.used;
    $("status").innerHTML =
      `完了：${data.checkedAt} <span class="quota-badge">今月の残り枠 ${remaining}回</span>`;
    if (typeof data.knowledgeCount === "number") {
      $("loopBadge").textContent = `🔄 学習した知見：${data.knowledgeCount}件（運用するほど賢くなります）`;
    }
    data.results.forEach(renderResult);
  } catch (e) {
    $("status").innerHTML = `<span class="err">エラー：${e.message}</span>`;
  } finally {
    $("runBtn").disabled = false;
  }
});

// ===== ワンクリックコピー =====
function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const old = btn.textContent;
    btn.textContent = "✅ コピー完了";
    setTimeout(() => (btn.textContent = old), 1500);
  });
}

function renderResult(r) {
  if (r.error) {
    const e = document.createElement("div");
    e.className = "result-item";
    e.innerHTML = `<h3>${r.keyword}</h3><p style="color:#dc2626">${r.error}</p>`;
    $("results").appendChild(e);
    return;
  }

  // === 主軸：評価先URLの強調バナー ===
  let heroHtml = "";
  if (r.evalPrimary) {
    const others = r.evalOthers && r.evalOthers.length
      ? `<div class="hero-others">その他の評価ページ：${r.evalOthers
          .map((o) => `<code>${o.display}</code>（${o.position}位）`)
          .join(" / ")}</div>`
      : "";
    heroHtml = `
      <div class="hero-url">
        <div class="hero-label">現在の評価先URLは→</div>
        <div class="hero-value">
          <span id="heroval-${r.feedbackId}">${r.evalPrimary.display}</span>
          <button class="copy-btn" data-copy="${r.evalPrimary.display}">📋 コピー</button>
        </div>
        <div class="hero-meta">${r.evalPrimary.position}位 ／ ${r.evalPrimary.type}</div>
        ${others}
      </div>`;
  } else {
    heroHtml = `
      <div class="hero-url hero-none">
        <div class="hero-label">現在の評価先URLは→</div>
        <div class="hero-value-none">このキーワードでは、あなたのドメインは検索結果に表示されていません。</div>
      </div>`;
  }

  // 全URLの構造分解テーブル
  const rows = r.analyzed
    .map((a) => {
      const mineTag = a.isMine ? `<span class="mine-tag">★自社</span>` : "";
      return `
      <tr class="${a.isMine ? "row-mine" : ""}">
        <td>${a.position}</td>
        <td><span class="type-badge">${a.type}</span></td>
        <td>${a.category}</td>
        <td class="dir">${a.firstDir}</td>
        <td class="url"><a href="${a.url}" target="_blank" rel="noopener">${a.url}</a> ${mineTag}</td>
      </tr>`;
    })
    .join("");

  const s = r.summary;
  const dirBadges = s.topDirs
    .map((d) => `<span class="dir-badge">${d.dir} (${d.count})</span>`)
    .join(" ");
  const domBadges = s.topDomains
    .map((d) => `<span class="dom-badge">${d.host} (${d.count})</span>`)
    .join(" ");

  const mineHtml = r.mine.length
    ? r.mine
        .map((m) => `<li><strong>${m.type}</strong>：<a href="${m.url}" target="_blank" rel="noopener">${m.url}</a></li>`)
        .join("")
    : "<li>このキーワードのSERPに自社ページは表示されていません。</li>";

  const div = document.createElement("div");
  div.className = "result-item";
  div.innerHTML = `
    <h3>🔍 ${r.keyword}</h3>

    ${heroHtml}

    <div class="summary-box">
      <div>📊 <strong>評価されている主なページ種別：</strong>${s.dominantType}</div>
      <div>📐 <strong>平均階層の深さ：</strong>${s.avgDepth}（0=トップに近い / 大きいほど下層）</div>
      <div>📁 <strong>よく出る第1ディレクトリ：</strong>${dirBadges || "―"}</div>
      <div>🌐 <strong>ドメイン占有：</strong>${domBadges || "―"}</div>
    </div>

    <div class="mine-box">
      <strong>あなたのドメインの評価ページ：</strong>
      <ul>${mineHtml}</ul>
    </div>

    <table class="url-table">
      <thead>
        <tr><th>順位</th><th>URL種別</th><th>ページ性質</th><th>第1ディレクトリ</th><th>実際のURL</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="suggestion">
      <strong>🤖 AI構造インサイト${r.brief ? `（要約: ${r.brief}）` : ""}</strong><br>${r.insight}
    </div>

    <div class="fb-btns">
      <button class="fb-up">👍 参考になった</button>
      <button class="fb-down">👎 的外れ</button>
    </div>
  `;

  // コピーボタン
  const copyBtn = div.querySelector(".copy-btn");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => copyText(copyBtn.dataset.copy, copyBtn));
  }

  div.querySelector(".fb-up").addEventListener("click", () =>
    sendFeedback(r.feedbackId, "up", r.insight, div)
  );
  div.querySelector(".fb-down").addEventListener("click", () =>
    sendFeedback(r.feedbackId, "down", r.insight, div)
  );

  $("results").appendChild(div);
}

async function sendFeedback(feedbackId, verdict, insight, div) {
  await fetch(`${API_BASE}/api/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feedbackId, verdict, insight }),
  });
  div.querySelector(".fb-btns").innerHTML =
    verdict === "up"
      ? "<small>✅ URL構造の知見として学習しました（次回分析に活かされます）</small>"
      : "<small>記録しました（今後この傾向は避けます）</small>";

  // Closed Loop：学習件数バッジを更新
  try {
    const res = await fetch(`${API_BASE}/api/stats`);
    const st = await res.json();
    const rate = st.upRate != null ? `／👍率 ${st.upRate}%` : "";
    $("loopBadge").textContent = `🔄 学習した知見：${st.knowledgeCount}件${rate}（運用するほど賢くなります）`;
  } catch (_) {}
}
