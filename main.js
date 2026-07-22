const $ = (id) => document.getElementById(id);

$("runBtn").addEventListener("click", async () => {
  const domain = $("domain").value.trim();
  const keywords = $("keywords").value
    .split("\n")
    .map((k) => k.trim())
    .filter(Boolean);

  if (keywords.length === 0) {
    $("status").textContent = "キーワードを入力してください。";
    return;
  }

  $("status").textContent = "検索・構造分析中…";
  $("results").innerHTML = "";

  try {
    const res = await fetch(`${API_BASE}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain, keywords }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    const remaining = data.quota.limit - data.quota.used;
    $("status").textContent = `完了：${data.checkedAt}（今月の残り枠: ${remaining}回）`;
    data.results.forEach(renderResult);
  } catch (e) {
    $("status").textContent = "エラー：" + e.message;
  }
});

function renderResult(r) {
  if (r.error) {
    const e = document.createElement("div");
    e.className = "result-item";
    e.innerHTML = `<h3>${r.keyword}</h3><p style="color:#dc2626">${r.error}</p>`;
    $("results").appendChild(e);
    return;
  }

  // 全URLの構造分解テーブル（メイン表示）
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

  // SERP構造サマリー
  const s = r.summary;
  const dirBadges = s.topDirs
    .map((d) => `<span class="dir-badge">${d.dir} (${d.count})</span>`)
    .join(" ");
  const domBadges = s.topDomains
    .map((d) => `<span class="dom-badge">${d.host} (${d.count})</span>`)
    .join(" ");

  // 自社ページ
  const mineHtml = r.mine.length
    ? r.mine
        .map((m) => `<li><strong>${m.type}</strong>：<a href="${m.url}" target="_blank" rel="noopener">${m.url}</a></li>`)
        .join("")
    : "<li>このキーワードのSERPに自社ページは表示されていません。</li>";

  const div = document.createElement("div");
  div.className = "result-item";
  div.innerHTML = `
    <h3>🔍 ${r.keyword}</h3>

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
}
