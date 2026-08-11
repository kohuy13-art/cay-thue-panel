const sb = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);

const $ = x => document.querySelector(x);
const $$ = x => document.querySelectorAll(x);

let orders = [], boosters = [], deposits = [];

const money = n =>
  new Intl.NumberFormat("vi-VN").format(n || 0) + "đ";

const esc = s =>
  String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",
    '"':"&quot;","'":"&#039;"
  }[m]));

const cls = s =>
  s === "Đang cày" ? "doing" :
  s === "Hoàn thành" ? "done" :
  s === "Đã hủy" ? "cancel" : "wait";


async function load(){

  const a = await sb
    .from("orders")
    .select("*")
    .order("created_at",{ascending:false});

  const b = await sb
    .from("boosters")
    .select("*")
    .order("created_at",{ascending:false});

  if(a.error || b.error){
    alert((a.error || b.error).message);
    return;
  }

  orders = a.data || [];
  boosters = b.data || [];

  await loadDeposits();
  render();
}


async function loadDeposits(){

  const {data,error} = await sb
    .from("deposit_requests")
    .select("*")
    .order("created_at",{ascending:false});

  if(error){
    console.error(error);
    deposits = [];
    renderDeposits();
    return;
  }

  deposits = data || [];
  renderDeposits();
}


function render(){

  const q = ($("#search")?.value || "").toLowerCase();
  const f = $("#filter")?.value || "";

  const os = orders.filter(o =>
    (!q ||
      `${o.id} ${o.customer} ${o.game} ${o.service}`
      .toLowerCase()
      .includes(q)
    ) &&
    (!f || o.status === f)
  );

  $("#total").textContent = orders.length;

  $("#doing").textContent =
    orders.filter(x => x.status === "Đang cày").length;

  $("#done").textContent =
    orders.filter(x => x.status === "Hoàn thành").length;

  $("#money").textContent =
    money(
      orders
        .filter(x => x.status === "Hoàn thành")
        .reduce((a,x) => a + Number(x.price),0)
    );

  $("#recent").innerHTML =
    orders.slice(0,6).map(o => `
      <p>
        <b>${esc(o.customer)}</b>
        · ${esc(o.game)}
        · ${money(o.price)}
        <span class="badge ${cls(o.status)}">
          ${esc(o.status)}
        </span>
      </p>
    `).join("") || "Chưa có đơn";

  $("#rows").innerHTML =
    os.map(o => `
      <tr>
        <td>${o.id.slice(0,8)}</td>
        <td>${esc(o.customer)}</td>
        <td>${esc(o.game)}</td>
        <td>${esc(o.service)}</td>
        <td>${money(o.price)}</td>
        <td>
          <span class="badge ${cls(o.status)}">
            ${esc(o.status)}
          </span>
        </td>
        <td>${esc(o.booster || "—")}</td>
        <td>
          <button onclick="editOrder('${o.id}')">Sửa</button>
          <button onclick="delOrder('${o.id}')">Xóa</button>
        </td>
      </tr>
    `).join("");

  let c = {};

  orders.forEach(o => {
    c[o.customer] ??= {
      contact:o.contact,
      count:0,
      total:0
    };

    c[o.customer].count++;
    c[o.customer].total += Number(o.price);
  });

  $("#customersRows").innerHTML =
    Object.entries(c).map(([n,v]) => `
      <tr>
        <td>${esc(n)}</td>
        <td>${esc(v.contact)}</td>
        <td>${v.count}</td>
        <td>${money(v.total)}</td>
      </tr>
    `).join("");

  $("#boostersGrid").innerHTML =
    boosters.map(b => `
      <div class="person">
        <h3>🎮 ${esc(b.name)}</h3>
        <p>${esc(b.game)}</p>
        <p>${esc(b.contact)}</p>
        <small>
          ● ${b.online ? "Online" : "Offline"}
        </small>
      </div>
    `).join("");

  renderDeposits();
}


function renderDeposits(){

  const box = $("#depositRows");

  if(!box) return;

  if(!deposits.length){

    box.innerHTML = `
      <tr>
        <td colspan="7">
          Chưa có yêu cầu nạp tiền
        </td>
      </tr>
    `;

    return;
  }

  box.innerHTML = deposits.map(d => {

    let status =
      d.status === "approved"
      ? `<span class="badge done">Đã duyệt</span>`
      : d.status === "rejected"
      ? `<span class="badge cancel">Từ chối</span>`
      : `<span class="badge wait">Chờ duyệt</span>`;

    return `
      <tr>

        <td>${esc(d.user_id.slice(0,8))}</td>

        <td>
          <b>${money(d.amount)}</b>
        </td>

        <td>${esc(d.transfer_code || "—")}</td>

        <td>${esc(d.note || "—")}</td>

        <td>${status}</td>

        <td>
          ${new Date(d.created_at).toLocaleString("vi-VN")}
        </td>

        <td>

          ${
            d.status === "pending"
            ? `
              <button onclick="approveDeposit('${d.id}')">
                ✅ Duyệt
              </button>

              <button onclick="rejectDeposit('${d.id}')">
                ❌ Từ chối
              </button>
            `
            : "Đã xử lý"
          }

        </td>

      </tr>
    `;

  }).join("");
}


/* DUYỆT NẠP TIỀN */

window.approveDeposit = async function(id){

  if(!confirm("Bạn chắc chắn muốn duyệt yêu cầu này?"))
    return;

  const {error} = await sb.rpc(
    "approve_deposit",
    {
      p_deposit_id:id
    }
  );

  if(error){
    alert("Không thể duyệt:\n" + error.message);
    return;
  }

  alert("Đã duyệt và cộng tiền vào ví.");

  await loadDeposits();
};


/* TỪ CHỐI */

window.rejectDeposit = async function(id){

  if(!confirm("Bạn chắc chắn muốn từ chối yêu cầu này?"))
    return;

  const {error} = await sb
    .from("deposit_requests")
    .update({
      status:"rejected",
      reviewed_at:new Date().toISOString()
    })
    .eq("id",id)
    .eq("status","pending");

  if(error){
    alert(error.message);
    return;
  }

  await loadDeposits();
};


/* ĐƠN HÀNG */

function openOrder(o){

  $("#oid").value = o?.id || "";

  [
    "customer",
    "contact",
    "game",
    "service",
    "price",
    "booster",
    "status",
    "note"
  ].forEach(k => {

    $("#" + k).value =
      o?.[k] ??
      (k === "status" ? "Chờ xử lý" : "");

  });

  $("#modal").classList.add("show");
}


$("#loginForm").onsubmit = async e => {

  e.preventDefault();

  $("#loginMsg").textContent = "Đang đăng nhập...";

  const {error} = await sb.auth.signInWithPassword({

    email:$("#email").value,

    password:$("#password").value

  });

  if(error)
    $("#loginMsg").textContent = error.message;
};


sb.auth.onAuthStateChange((_event,session) => {

  if(session){

    $("#login").classList.add("hidden");
    $("#app").classList.remove("hidden");

    load();

  }else{

    $("#login").classList.remove("hidden");
    $("#app").classList.add("hidden");

  }

});


$("#logout").onclick = () =>
  sb.auth.signOut({scope:"local"});


$$(".nav").forEach(n => {

  n.onclick = () => {

    $$(".nav").forEach(
      x => x.classList.remove("active")
    );

    n.classList.add("active");

    $$(".page").forEach(
      x => x.classList.remove("active")
    );

    $("#" + n.dataset.page)
      .classList.add("active");

    $("#title").textContent =
      n.textContent.replace(/^\S+\s/,"");

  };

});


$("#add").onclick = () => openOrder();

$("#close").onclick = () =>
  $("#modal").classList.remove("show");

$("#search").oninput = render;

$("#filter").onchange = render;


$("#orderForm").onsubmit = async e => {

  e.preventDefault();

  const o = {

    customer:$("#customer").value,
    contact:$("#contact").value,
    game:$("#game").value,
    service:$("#service").value,
    price:Number($("#price").value),
    booster:$("#booster").value,
    status:$("#status").value,
    note:$("#note").value

  };

  const oid = $("#oid").value;

  const r = oid
    ? await sb.from("orders").update(o).eq("id",oid)
    : await sb.from("orders").insert(o);

  if(r.error){
    alert(r.error.message);
    return;
  }

  $("#modal").classList.remove("show");

  load();
};


window.editOrder = id =>
  openOrder(
    orders.find(x => x.id === id)
  );


window.delOrder = async id => {

  if(!confirm("Xóa đơn?"))
    return;

  const r = await sb
    .from("orders")
    .delete()
    .eq("id",id);

  if(r.error)
    alert(r.error.message);
  else
    load();
};


/* BOOSTER */

$("#addBooster").onclick = () =>
  $("#bmodal").classList.add("show");

$("#bclose").onclick = () =>
  $("#bmodal").classList.remove("show");


$("#boosterForm").onsubmit = async e => {

  e.preventDefault();

  const r = await sb
    .from("boosters")
    .insert({

      name:$("#bn").value,
      game:$("#bg").value,
      contact:$("#bc").value

    });

  if(r.error){

    alert(r.error.message);
    return;

  }

  $("#bmodal").classList.remove("show");

  e.target.reset();

  load();

};
