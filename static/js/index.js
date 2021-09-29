var localVideo = document.getElementById("localVideo");
var localStream = null;
var remoteVideoElements = [];
var peerConnections = [];
var mediaConstraints = {
  mandatory: {
    OfferToReceiveAudio: true,
    OfferToReceiveVideo: true,
  },
};

// 映像設定変数 初期化
var videoWidth = null;
var videoHeight = null;
var videoFps = null;

// 管理者設定用のために現在URLを取得
// let locationURL = location.href;
let locationURL = location.pathname;
document.querySelector("#location-path").defaultValue = locationURL;

/**
 * 映像初期設定
 * 設定保存されていれば、cookieに保存されている
 * 保存されていれば、数値をセット
 */
// cookieを配列で取得
let cookieArr = getCookieArray();
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

  //JSONデータを引数に受け取り、初期設定
  function setting(jsonObj) {
    const settingData = jsonObj;
    // 現在の設定を確認
    console.log(settingData);
    let setWidth = settingData.video.width;
    let setHeight = settingData.video.height;
    let setFps = settingData.video.frameRate;
    videoWidth = setWidth;
    videoHeight = setHeight;
    videoFps = setFps;
  }
}
// cookieが保存されていれば、cookieの数値を設定
else {
  var videoWidth = cookieArr["videoWidth"];
  var videoHeight = cookieArr["videoHeight"];
  var videoFps = cookieArr["videoFps"];
  let expires = timeLimit(32); //32日間、約一ヶ月延長
  document.cookie = "videoWidth=" + videoWidth + ";" + expires;
  secure;
  document.cookie = "videoHeight=" + videoHeight + ";" + expires;
  secure;
  document.cookie = "videoFps=" + videoFps + ";" + expires;
  secure;
  document.querySelector("#normal-set").checked = false;
}

// webRTCの設定情報取得関数
function getVideoStatus() {
  let constraints = navigator.mediaDevices.getSupportedConstraints();
  console.log(constraints);
}

var selfId;
var myName;
function toFullScreenable(target) {
  target.requestFullscreen =
    target.requestFullscreen ||
    target.webkitRequestFullscreen ||
    target.mozRequestFullScreen ||
    target.msRequestFullscreen;
  target.onclick = function () {
    if (!document.webkitIsFullScreen) {
      target.webkitRequestFullscreen();
    } else {
      document.webkitExitFullscreen();
    }
  };
}
toFullScreenable(localVideo);

var socketReady = false;
var reloadFunction = function () {};
var joinedToRoom = false;
var socket = io.connect("/");
socket.on("connect", function (event) {
  socketReady = true;
});
function joinToRoom() {
  socket.json.emit("join", { room: location.pathname });

  socket
    .on("joined", function (event) {
      joinedToRoom = true;
      // socket.idが入っている
      selfId = event.id;
      // console.log(myName);
      myName = event.name;
    })
    .on("otherJoined", function (event) {
      sendOffer(event.id, event.name);
      myNameSend(selfId, myName);
      // var myName = event.name;
    })
    .on("message", function (event) {
      if (event.data.type === "offer") {
        var id = event.id;
        var name = event.name;
        if (peerConnections[id]) {
          peerConnections[id].close();
        }
        var peerConnection = prepareNewConnection(id, name);
        peerConnections[id] = peerConnection;
        peerConnection.setRemoteDescription(
          new RTCSessionDescription(event.data)
        );
        sendAnswer(event);
        myNameSend(selfId, myName);
      } else if (event.data.type === "answer") {
        var peerConnection = peerConnections[event.id];
        if (!peerConnection) {
          console.error("peer NOT exists");
          return;
        }
        peerConnection.setRemoteDescription(
          new RTCSessionDescription(event.data)
        );
        myNameSend(selfId, myName);
      } else if (event.data.type === "candidate") {
        if (!peerConnections[event.id]) {
          peerConnections[event.id] = prepareNewConnection(
            event.id,
            event.name
          );
        }
        var peerConnection = peerConnections[event.id];
        var candidate = new RTCIceCandidate({
          sdpMLineIndex: event.data.sdpMLineIndex,
          sdpMid: event.data.sdpMid,
          candidate: event.data.candidate,
        });
        peerConnection.addIceCandidate(candidate);
      } else if (event.data.type === "stop") {
        stopPeer(event.id);
      }
    })
    .on("otherDisconnected", function (event) {
      stopPeer(event.id);
    })
    .on("stop", function (event) {
      peerConnections[event.id].close();
    })
    .on("lockouted", function (event) {
      openDialog("lockoutedDialog");
    })
    .on("locked", function (event) {
      lockRoom(true);
    })
    .on("otherHandUp", function (remoteId) {
      otherHandUp(remoteId);
    })
    .on("othernamesend", function (event) {
      otherNameCreate(event);
      // console.log(event);
    });
}

function sendOffer(targetId, targetName) {
  var peerConnection = prepareNewConnection(targetId, targetName);
  peerConnections[targetId] = peerConnection;

  peerConnection.createOffer(
    function (sessionDescription) {
      peerConnection.setLocalDescription(sessionDescription);
      socket.json.emit("offer", {
        id: selfId,
        targetId: targetId,
        name: targetName,
        data: sessionDescription,
      });
    },
    function () {},
    mediaConstraints
  );
}

function sendAnswer(event) {
  if (!peerConnections[event.id]) {
    console.error("peer NOT exists");
    return;
  }
  var peerConnection = peerConnections[event.id];
  peerConnection.createAnswer(
    function (sessionDescription) {
      peerConnection.setLocalDescription(sessionDescription);
      socket.json.send({
        id: selfId,
        data: sessionDescription,
      });
    },
    function () {
      console.log("Create Answer failed");
    },
    mediaConstraints
  );
}
function openDialog(dialog) {
  if (typeof dialog === "string") {
    dialog = document.getElementById(dialog);
  }
  dialog.style.display = "block";
  doDialogChange(dialog, 0.01, 1.2);
}
function closeDialog(dialog) {
  if (typeof dialog === "string") {
    dialog = document.getElementById(dialog);
  }
  doDialogChange(dialog, 1, 0.9);
}
function doDialogChange(dialog, opacity, degree) {
  newOpacity = opacity * degree;
  if (newOpacity > 1) {
    dialog.style.opacity = 1;
  } else if (newOpacity < 0.001) {
    dialog.style.opacity = 0;
    dialog.style.display = "none";
  } else {
    dialog.style.opacity = newOpacity;
    setTimeout(function () {
      doDialogChange(dialog, newOpacity, degree);
    }, 30);
  }
}
function prepareNewConnection(remoteId, targetName) {
  // var RTCPeerConnection = RTCPeerConnection || webkitRTCPeerConnection;
  var RTCPeerConnection =
    window.RTCPeerConnection ||
    window.webkitRTCPeerConnection ||
    window.mozRTCPerrConnection;
  var pc_config = { iceServers: [] };
  var peer = null;
  try {
    peer = new RTCPeerConnection(pc_config);
  } catch (e) {
    console.error("fail " + e.message);
  }

  peer.onicecandidate = function (event) {
    if (event.candidate) {
      socket.json.emit("candidate", {
        id: selfId,
        targetId: remoteId,
        data: {
          type: "candidate",
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          sdpMid: event.candidate.sdpMid,
          candidate: event.candidate.candidate,
        },
      });
      // console.log(selfId);
      // console.log(remoteId);
    }
  };

  peer.addStream(localStream);

  peer.addEventListener("addstream", onRemoteStreamAdded, false);
  peer.addEventListener("removestream", onRemoteStreamRemoved, false);
  var remoteVideo;
  // var remoteName;
  var remoteArea;
  function onRemoteStreamAdded(event) {
    var elementId = "video_" + remoteId;
    var areaId = "area_" + remoteId;
    remoteVideo = document.getElementById(elementId);
    remoteArea = document.getElementById(areaId);
    if (!remoteVideo) {
      if (!remoteArea) {
        remoteArea = document.createElement("div");
        remoteArea.className = "remoteArea";
        remoteArea.id = areaId;
        document.getElementById("video_wrap").appendChild(remoteArea);
      }
      remoteVideo = document.createElement("video");
      remoteVideo.className = "video";
      remoteVideo.id = elementId;
      // 追記
      remoteVideo.setAttribute("playsinline", true);
      remoteVideo.setAttribute("autoplay", true);
      remoteVideo.setAttribute("muted", true);
      remoteVideo.setAttribute("cntrols", true);
      document.getElementById(areaId).appendChild(remoteVideo);
      toFullScreenable(remoteVideo);
      // if(targetName != myName){
      //     remoteName = document.createElement('span');
      //     remoteName.className = 'remoteName';
      //     // remoteName.id = elementId;
      //     console.log(targetName);
      //     remoteName.textContent = targetName;
      //     document.getElementById(areaId).appendChild(remoteName);
      // }else{
      //     console.log('名前が一緒');
      // }
    }
    // remoteVideo.src = URL.createObjectURL(event.stream);
    remoteVideo.srcObject = event.stream;
    remoteVideo.load();
    remoteVideo.play();
  }
  function onRemoteStreamRemoved(event) {
    remoteVideo.src = "";
    remoteVideo.parentNode.removeChild(remoteVideo);
    // remoteArea.parentNode.removeChild(remoteArea);
    // remoteName.parentNode.removeChild(remoteName);
  }
  peer.removeElement = function () {
    onRemoteStreamRemoved();
  };
  return peer;
}

function prepareStream(stream) {
  var resetPeerIds = [];
  for (var key in peerConnections) {
    resetPeerIds.push(key);
  }
  stopLocalStream();
  localStream = stream;
  // localVideo.src = URL.createObjectURL(stream);
  localVideo.srcObject = stream;
  localVideo.play();
  if (!joinedToRoom) {
    joinToRoom();
  } else {
    resetPeerIds.forEach(function (id) {
      sendOffer(id);
    });
  }
}
var firstActionForReload = true; //for fail to handshake;
function initVideoArea() {
  setTimeout(function () {
    reloadFunction();
    openDialog("videoArea");
  }, 500);
}

/**
 * 映像設定画面オープン
 * 設定を保存にチェックされていれば、cookieに保存
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
  document.querySelector("#itemArea").className = "";
}

/**
 * 映像設定 変更
 * 設定を保存にチェックされていれば、cookieに保存
 */
function setApplyConstraints() {
  videoWidth = document.querySelector("#set-width").value;
  videoHeight = document.querySelector("#set-height").value;
  videoFps = document.querySelector("#set-fps").value;
  let saveCheck = document.querySelector("#save");
  if (saveCheck.checked) {
    let expires = timeLimit(32); //32日間、約一ヶ月を設定
    document.cookie = "videoWidth=" + videoWidth + ";" + expires;
    secure;
    document.cookie = "videoHeight=" + videoHeight + ";" + expires;
    secure;
    document.cookie = "videoFps=" + videoFps + ";" + expires;
    secure;
  }

  let videoTrack = localStream.getVideoTracks()[0];
  let currentConstrains = videoTrack.getConstraints();
  console.log("変更前の値:", currentConstrains);
  videoTrack
    .applyConstraints({
      width: videoWidth,
      height: videoHeight,
      frameRate: videoFps,
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

// cookieを連想配列に格納
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

// cookieの有効期限取得
function timeLimit(setDate) {
  let nowdate = new Date(); //現在の日付データを取得
  nowdate.setTime(nowdate.getTime() + setDate * 24 * 60 * 60 * 1000); //setDateが30なら、1ヶ月後の日付データを作成
  let limitDate = nowdate.toGMTString(); //GMT形式に変換して変数kigendateに格納
  let expires = "expires=" + limitDate + "; ";
  return expires;
}

// 管理者設定画面
document.addEventListener("keydown", (event) => {
  let adminSettingArea = document.querySelector("#admin-setting");
  let encryptedArea = document.querySelector("#encrypted-area");
  if (event.ctrlKey && event.code === "Slash") {
    if (adminSettingArea.style.display === "none") {
      adminSettingArea.style.display = "block";
    } else {
      adminSettingArea.style.display = "none";
    }
  } else if (event.ctrlKey && event.code === "IntlRo") {
    if (adminSettingArea.style.display === "block") {
      encryptedArea.style.display = "block";
    }
  }
});


function startVideo() {
  reloadFunction = startVideo;
  // navigator.getUserMedia({ video: true, audio: true },
  //     function (stream) {
  //         prepareStream(stream);
  //         if (firstActionForReload) {
  //             initVideoArea();
  //             firstActionForReload = false;
  //         }
  //     },
  //     function (error) {
  //         console.error('fail ' + error.code);
  //         return;
  //   var medias = { video: true, audio: true };
  let medias = {
    video: true,
    audio: true,
    // 以下、追加
    // 各数値は最大値の設定
    width: { max: videoWidth },
    height: { max: videoHeight },
    frameRate: { max: videoFps },
  };
  navigator.mediaDevices
    .getUserMedia(medias)
    .then(function (stream) {
      prepareStream(stream);
      if (firstActionForReload) {
        initVideoArea();
        firstActionForReload = false;
      }
    })
    .catch(function (error) {
      console.error("fail" + error.code);
      return;
    });
}
// );
// }
var screenShare = new SkyWay.ScreenShare({ debug: true });
function startScreenShare() {
  if (!screenShare.isEnabledExtension()) {
    if (navigator.userAgent.toLowerCase().indexOf("chrome") != -1) {
      location.href = "screenshare_chrome_extension.crx";
      var dialog = document.getElementById("chromeExtensionInstallDialog");
    } else {
      var dialog = document.getElementById(
        "screenShareOnlySupportedWithChrome"
      );
    }
    document.getElementById("chromeExtensionInstallDialogCloseButton").onclick =
      function () {
        closeDialog(dialog);
      };
    openDialog(dialog);
    return;
  }
  reloadFunction = startScreenShare;
  screenShare.startScreenShare(
    {
      Width: screen.width,
      Height: screen.height,
      FrameRate: 30,
      audio: false,
    },
    function (stream) {
      navigator.getUserMedia(
        { video: false, audio: true },
        function (audioStream) {
          stopLocalStream();
          var audioTrack = audioStream.getAudioTracks()[0];
          stream.addTrack(audioTrack);
          prepareStream(stream);
          if (firstActionForReload) {
            initVideoArea();
            firstActionForReload = false;
          }
        },
        function (error) {
          console.error("failed " + error.code);
          return;
        }
      );
    },
    function (error) {
      console.error(error + " load screen failed");
    }
  );
}
function mute() {
  localStream.removeTrack(localStream.getAudioTracks()[0]);
  var soundButton = document.getElementById("soundButton");
  soundButton.onclick = appendsSound;
  soundButton.getElementsByTagName("img")[0].src = "images/mute.png";
  for (var key in peerConnections) {
    sendOffer(key);
  }
}
function appendsSound() {
  navigator.getUserMedia(
    { video: false, audio: true },
    function (audioStream) {
      var audioTrack = audioStream.getAudioTracks()[0];
      localStream.addTrack(audioTrack);
      var soundButton = document.getElementById("soundButton");
      soundButton.onclick = mute;
      soundButton.getElementsByTagName("img")[0].src = "images/sound.png";
      for (var key in peerConnections) {
        sendOffer(key);
      }
    },
    function (error) {
      console.error("failed " + error.code);
      return;
    }
  );
}

function stopLocalStream() {
  if (localStream) {
    localVideo.src = "";
  }
}

function stop() {
  if (localStream) {
    localVideo.src = "";
  }
  for (var key in peerConnections) {
    peerConnections[key].removeElement();
    peerConnections[key].close();
    var closeAll = function (streams) {
      for (var stream of streams) {
        try {
          peerConnections[key].removeStream(stream);
        } catch (e) {
          console.error(e);
        }
      }
    };
    var streams = peerConnections[key].getRemoteStreams();
    closeAll(streams);
    streams = peerConnections[key].getLocalStreams();
    closeAll(streams);
    delete peerConnections[key];
  }
  socket.json.emit("stop", {
    id: selfId,
  });
  location.href = "/";
}

function stopPeer(id) {
  peerConnections[id].removeElement();
  peerConnections[id].close();
  delete peerConnections[id];
}
function showLink() {
  var linkText = document.getElementById("linkText");
  linkText.value = location.href;
  document.getElementById("linkCopyButton").onclick = function () {
    linkText.select();
    var retVal = document.execCommand("copy");
  };
  openDialog("linkDialog");
  document.getElementById("linkDialogCloseButton").onclick = function () {
    closeDialog("linkDialog");
  };
}

function lockRoom(displayOnly) {
  var button = document.getElementById("lockButton");
  button.onclick = unlockRoom;
  button.getElementsByTagName("img")[0].src = "images/lock.png";
  if (!displayOnly) {
    socket.json.emit("lock");
  }
}
function unlockRoom() {
  //u cant unlock. everyone must out.
}

function handUp() {
  socket.emit("handup", socket.id);
  var myVideoArea = document.getElementById("my_video_area");
  var myhand = document.createElement("img");
  myhand.src = "images/hand.png";
  myhand.className = "handImg";
  myVideoArea.appendChild(myhand);
  setTimeout(function () {
    myVideoArea.removeChild(myhand);
  }, 15000);
}

function otherHandUp(remoteId) {
  var otherHandUpId = "area_" + remoteId.id;
  // console.log(otherHandUpId);
  // objectが返ってきてた
  // console.log(remoteId);
  var hand = document.createElement("img");
  hand.src = "images/hand.png";
  hand.className = "handImg";
  document.getElementById(otherHandUpId).appendChild(hand);
  setTimeout(function () {
    document.getElementById(otherHandUpId).removeChild(hand);
  }, 15000);
}

function myNameSend(myId, myName) {
  socket.emit("mynamesend", { id: myId, name: myName });
  console.log("myname send");
}

function otherNameCreate(otherconf) {
  if (otherconf.id.name != myName) {
    var otherId = "area_" + otherconf.id.id;
    var otherArea = document.getElementById(otherId);
    if (!otherArea) {
      otherArea = document.createElement("div");
      otherArea.className = "remoteArea";
      otherArea.id = otherId;
      document.getElementById("video_wrap").appendChild(otherArea);
      remoteName = document.createElement("span");
      remoteName.className = "remoteName";
      // remoteName.id = elementId;
      // console.log(otherconf);
      remoteName.textContent = otherconf.id.name;
      otherArea.appendChild(remoteName);
      socket.emit("mynamesend", { id: selfId, name: myName });
    }
  } else {
    console.log("名前が一緒");
    return;
  }
}

setTimeout(startVideo, 0);
