// 映像設定変数 初期化
var videoWidth = null;
var videoHeight = null;
var videoFps = null;
var aspectRatio = null;

// 管理者設定用のために現在URLを取得
document.querySelector("#location-path").defaultValue = location.pathname;

/**
 * 映像初期設定
 * 設定保存されていれば、cookieに保存されている
 * 保存されていれば、数値をセット
 */
// cookieを配列で取得
let cookieArr = getCookieArray();
// console.log(cookieArr);
// 映像設定のcookieの存在判定
if (!cookieArr["videoWidth"]) {
  // setting.jsonファイルを読み込み
  fetch("../setting.json")
    .then((response) => {
      return response.json(); //BodyからJSONを返す
    })
    .then((result) => {
      setting(result); //取得したJSONデータをsetting関数に渡す
    })
    .catch((e) => {
      console.log(e); //例外処理
      // 設定ファイルの読み込みに失敗した場合、以下の設定にする
      videoWidth = 640;
      videoHeight = 360;
      videoFps = 30;
    });
}
// cookieが保存されていれば、cookieの数値を再設定
else {
  settingWithcookie(cookieArr);
}

/**
 * 映像の初期設定
 * @param {object} Obj
 */
function setting(obj) {
  const settingData = obj;
  // 現在の設定を確認
  console.log(settingData);
  videoWidth = settingData.video.width;
  videoHeight = settingData.video.height;
  videoFps = settingData.video.frameRate;
  aspectRatio = videoWidth / videoHeight;
}

/**
 * クッキーの数値を設定
 * @param {Array} cookieArr
 */
function settingWithcookie(cookieArr) {
  videoWidth = cookieArr["videoWidth"];
  videoHeight = cookieArr["videoHeight"];
  videoFps = cookieArr["videoFps"];
  let expires = timeLimit(32); //32日間、約一ヶ月延長
  document.cookie = "videoWidth=" + videoWidth + ";" + expires;
  document.cookie = "videoHeight=" + videoHeight + ";" + expires;
  document.cookie = "videoFps=" + videoFps + ";" + expires;
  document.querySelector("#HD-normal-quality").checked = false;
  //映像設定に該当するラジオボタンにチェック
  if (videoWidth === "1280" && videoHeight === "720") {
    document.getElementById("HD-high-quality").checked = true;
  }
  if (videoWidth === "640" && videoHeight === "360") {
    document.getElementById("HD-normal-quality").checked = true;
  }
  if (videoWidth === "426" && videoHeight === "240") {
    document.getElementById("HD-low-quality").checked = true;
  }
  if (videoWidth === "640" && videoHeight === "480") {
    document.getElementById("SD-normal-quality").checked = true;
  }
  if (videoWidth === "320" && videoHeight === "240") {
    document.getElementById("SD-low-quality").checked = true;
  }
}

/**
 * 映像設定 変更
 * 設定を保存にチェックされていれば、cookieに保存
 */
function setApplyConstraints() {
  videoWidth = document.querySelector("#set-width").value;
  videoHeight = document.querySelector("#set-height").value;
  videoFps = document.querySelector("#set-fps").value;
  aspectRatio = videoWidth / videoHeight;
  let saveCheck = document.querySelector("#save");
  if (saveCheck.checked) {
    let expires = timeLimit(32); //32日間、約一ヶ月を設定
    document.cookie = "videoWidth=" + videoWidth + ";" + expires;
    document.cookie = "videoHeight=" + videoHeight + ";" + expires;
    document.cookie = "videoFps=" + videoFps + ";" + expires;
  }

  let videoTrack = localStream.getVideoTracks()[0];
  let currentConstrains = videoTrack.getConstraints();
  console.log("変更前の値:", currentConstrains);
  videoTrack
    .applyConstraints({
      width: videoWidth,
      height: videoHeight,
      frameRate: videoFps,
      aspectRatio: aspectRatio,
    })
    .then(() => {
      currentConstrains = videoTrack.getConstraints();
      console.log("映像の設定値:", currentConstrains);
      document.querySelector(".setting-area").style.display = "none";
      document.querySelector("#itemArea").className = "";
      // alert("映像の設定が完了しました\n\n横幅：" + videoWidth + "\n縦幅：" + videoHeight + "\nフレームレート：" + videoFps);
      document.querySelector("#setting-close-Button").style.display = "none";
      document.querySelector("#setting-open-Button").style.display = "block";
    })
    .catch((e) => {
      console.log("制約を設定できませんでした:", e);
      alert("ブラウザが対応していません\n推奨ブラウザ：Google chrome");
    });
}

/**
 * 映像設定(cookie)削除
 */
function setteingRemove() {
  // cookieを配列で取得
  let cookieArr = getCookieArray();
  // 映像設定のcookieの存在判定
  if (cookieArr["videoWidth"]) {
    let check = confirm("すべての設定が削除されます。\n本当によろしいですか？");
    if (check) {
      document.cookie = "videoWidth=" + videoWidth + ";max-age=0;";
      document.cookie = "videoHeight=" + videoHeight + ";max-age=0;";
      document.cookie = "videoFps=" + videoFps + ";max-age=0;";

      cookieArr = getCookieArray();
      if (!cookieArr["videoWidth"]) {
        alert("設定が削除されました。");
      } else {
        alert("削除できませんでした。");
      }
    }
  } else {
    alert("設定は保存されていません");
  }
}

// webRTCの設定情報取得関数
function getVideoStatus() {
  let constraints = navigator.mediaDevices.getSupportedConstraints();
  console.log(constraints);
}

/**
 * 映像設定画面オープン
 */
function settingOpen() {
  document.querySelector("#setting-open-Button").style.display = "none";
  document.querySelector("#setting-close-Button").style.display = "block";
  document.querySelector("#set-width").value = videoWidth;
  document.querySelector("#set-height").value = videoHeight;
  document.querySelector("#set-fps").value = videoFps;
  document.querySelector("#itemArea").className = "itemArea-open";
  setTimeout(function () {
    document.querySelector(".setting-area").style.display = "flex";
  }, 500);
}

/**
 * 映像設定画面クローズ
 */
function settingClose() {
  document.querySelector("#setting-close-Button").style.display = "none";
  document.querySelector("#setting-open-Button").style.display = "block";
  document.querySelector(".setting-area").style.display = "none";
  document.querySelector("#admin-setting").style.display = "none";
  document.querySelector("#itemArea").className = "";
}

/**
 * cookieを連想配列に格納
 * @returns { Array }
 */
function getCookieArray() {
  var arr = new Array();
  if (document.cookie != "") {
    var tmp = document.cookie.split("; ");
    for (var i = 0; i < tmp.length; i++) {
      var data = tmp[i].split("=");
      arr[data[0]] = decodeURIComponent(data[1]);
    }
  }
  return arr;
}

/**
 * cookieの有効期限取得
 * @param { Date } setDate
 * @returns { string }
 */
function timeLimit(setDate) {
  let nowdate = new Date(); //現在の日付データを取得
  nowdate.setTime(nowdate.getTime() + setDate * 24 * 60 * 60 * 1000); //setDateが30なら、1ヶ月後の日付データを作成
  let limitDate = nowdate.toGMTString(); //GMT形式に変換して変数kigendateに格納
  let expires = "expires=" + limitDate + "; ";
  return expires;
}

/**
 * 管理者設定画面表示
 * Ctrl + / で表示
 * 管理者画面表示の状態でCtrl + \ で文字の暗号化入力表示、パスワード変更の際にでも使って下さい
 */
document.addEventListener("keydown", (event) => {
  let adminSettingArea = document.querySelector("#admin-setting");
  let encryptedArea = document.querySelector("#encrypted-area");
  if (event.ctrlKey && event.code === "Slash") {
    if (adminSettingArea.style.display === "block") {
      adminSettingArea.style.display = "none";
      encryptedArea.style.display = "none";
    } else {
      adminSettingArea.style.display = "block";
    }
  }
  if (event.ctrlKey && event.code === "IntlRo") {
    if (adminSettingArea.style.display === "block") {
      encryptedArea.style.display = "block";
    }
  }
});

/**
 * 管理者設定前の確認メッセージ
 * @returns {bool}
 */
function adminSettingCheck() {
  if (window.confirm("サーバーの設定が変更されます\n本当によろしいですか？")) {
    // 確認ダイアログを表示
    return true; // 「OK」時は送信を実行
  }
}

/**
 * 映像設定値を入力ボックスに代入
 */
window.addEventListener("DOMContentLoaded", () => {
  let checkOption = document.getElementsByName("video-setting");
  checkOption.forEach(function (e) {
    e.addEventListener("click", function () {
      // console.log(e.value)
      if (e.value === "HD-high-quality") {
        document.querySelector("#set-width").value = 1280;
        document.querySelector("#set-height").value = 720;
        document.querySelector("#set-fps").value = 30;
      } else if (e.value === "HD-normal-quality") {
        document.querySelector("#set-width").value = 640;
        document.querySelector("#set-height").value = 360;
        document.querySelector("#set-fps").value = 30;
      } else if (e.value === "HD-low-quality") {
        document.querySelector("#set-width").value = 426;
        document.querySelector("#set-height").value = 240;
        document.querySelector("#set-fps").value = 30;
      } else if (e.value === "SD-normal-quality") {
        document.querySelector("#set-width").value = 640;
        document.querySelector("#set-height").value = 480;
        document.querySelector("#set-fps").value = 30;
      } else if (e.value === "SD-low-quality") {
        document.querySelector("#set-width").value = 320;
        document.querySelector("#set-height").value = 240;
        document.querySelector("#set-fps").value = 30;
      }
    });
  });
});
