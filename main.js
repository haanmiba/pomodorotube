var GoogleAuth;

const CLIENT_ID =
  "263383866383-1mgpakgpgqilo2v3aoc7kj3eane6enla.apps.googleusercontent.com";
const DISCOVERY_DOCS = [
  "https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest"
];
const SCOPES = "https://www.googleapis.com/auth/youtube.readonly";

const NUM_OF_MAX_RESULTS = 50;
const NUM_ROUNDS = 4;
const SECONDS_IN_A_MINUTE = 60;
const THRESHOLD_SECONDS = 15;
const FOCUS_MINUTES = 25;

const authorizeButton = document.getElementById("authorize-button");
const signoutButton = document.getElementById("signout-button");
const progressBar = document.getElementById("progress-bar");
const skipButton = document.getElementById("skip-button");
const pauseButton = document.getElementById("pause-button");
const newFocusVideoButton = document.getElementById("new-focus-video-button");
const newShortBreakVideoButton = document.getElementById(
  "new-short-break-video-button"
);
const content = document.getElementById("content");
const timerContainer = document.getElementById("timer-container");
const syncCheckbox = document.getElementById("sync-checkbox");
const videoContainer = document.getElementById("video-container");
const roundNumberContainer = document.getElementById("round-number-container");

var player;
var currentPhase;
var secondsInCurrentPhase;
var secondsRemaining;
var timerInterval;
var roundNumber;

var shortBreakVideoTimeout;

var focusVideoIds;
var breakVideos;
var shortBreakVideos;
var shortBreakVideoIndex;

var timerPaused;
var playerSyncedWithTimer;

// Load auth2 library
function handleClientLoad() {
  gapi.load("client:auth2", loadYoutubeIframePlayerAPI);
}

function loadYoutubeIframePlayerAPI() {
  let tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  let firstScriptTag = document.getElementsByTagName("script")[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}

function onYouTubeIframeAPIReady() {
  initClient();
}

// Init API client library and set up sign in listeners
function initClient() {
  gapi.client
    .init({
      discoveryDocs: DISCOVERY_DOCS,
      clientId: CLIENT_ID,
      scope: SCOPES
    })
    .then(() => {
      GoogleAuth = gapi.auth2.getAuthInstance();

      // Listen for sign in state changes
      GoogleAuth.isSignedIn.listen(updateSigninStatus);

      // Handle initial sign in state
      updateSigninStatus(GoogleAuth.isSignedIn.get());

      // Add event handlers to buttons
      authorizeButton.onclick = handleAuthClick;
      signoutButton.onclick = handleSignoutClick;
      newFocusVideoButton.onclick = handleNewFocusVideo;
      newShortBreakVideoButton.onclick = handleNewShortBreakVideo;
      syncCheckbox.onchange = handleSyncCheckboxChange;
      skipButton.onclick = clearTimer;
      pauseButton.onclick = handlePausePlayButton;
    });
}

// Sign in the user upon button click
function handleAuthClick(event) {
  GoogleAuth.signIn();
}

// Sign out the user upon button click
function handleSignoutClick(event) {
  GoogleAuth.signOut();
  clearInterval(timerInterval);
  currentPhase = "";
  secondsInCurrentPhase = -1;
  secondsRemaining = -1;
  roundNumber = 0;
  clearTimeout(shortBreakVideoTimeout);
  focusVideoIds = [];
  breakVideos = [];
  shortBreakVideos = [];
  shortBreakVideoIndex = 0;
  timerPaused = false;
  playerSyncedWithTimer = false;
}

function handleNewFocusVideo(event = undefined) {
  const videoId =
    focusVideoIds[Math.floor(Math.random() * focusVideoIds.length)];
  displayVideo(videoId);
  return true;
}

function handleNewShortBreakVideo(event = undefined) {
  clearTimeout(shortBreakVideoTimeout);
  const video = shortBreakVideos[shortBreakVideoIndex++];
  displayVideo(video.id);
  secondsRemaining = getVideoLength(video) + THRESHOLD_SECONDS;
  console.log(`Remaining seconds: ${secondsRemaining}`);
  secondsInCurrentPhase = secondsRemaining;
  shortBreakVideoTimeout = setTimeout(() => {
    newShortBreakVideoButton.style.display = "none";
  }, 10000);
  return true;
}

function handleSyncCheckboxChange(event) {
  playerSyncedWithTimer = event.target.checked;
}

function updateTimer() {
  let minutes = Math.floor(secondsRemaining / SECONDS_IN_A_MINUTE);
  let seconds = secondsRemaining - minutes * SECONDS_IN_A_MINUTE;

  if (minutes < 10) {
    minutes = "0" + minutes;
  }
  if (seconds < 10) {
    seconds = "0" + seconds;
  }

  timerContainer.innerHTML = `<h1>${minutes}:${seconds}</h1>`;

  progressBar.style.width = `${((secondsInCurrentPhase - secondsRemaining) /
    secondsInCurrentPhase) *
    100}%`;

  secondsRemaining--;
  if (secondsRemaining < 0) {
    clearTimer();
  }
}

function handlePausePlayButton(event) {
  if (timerPaused) {
    timerContainer.classList.remove("grey-text", "lighten-2");
    timerInterval = setInterval(updateTimer, 1000);
    timerPaused = false;
    pauseButton.innerHTML = "Pause";
    if (event !== undefined && playerSyncedWithTimer) {
      player.playVideo();
    }
  } else {
    timerContainer.classList.add("grey-text", "lighten-2");
    clearInterval(timerInterval);
    timerPaused = true;
    pauseButton.innerHTML = "Play";
    if (event !== undefined && playerSyncedWithTimer) {
      player.pauseVideo();
    }
  }
}

function clearTimer(event = undefined) {
  clearInterval(timerInterval);
  switchPhase(event);
  if (timerPaused) {
    handlePausePlayButton();
  } else {
    timerInterval = setInterval(updateTimer, 1000);
  }
}

function switchPhase(event) {
  if (currentPhase === "focus") {
    if (event === undefined) {
      roundNumber++;
    }
    updatePhaseNumber();
    currentPhase = "break";
    newFocusVideoButton.style.display = "none";
    newShortBreakVideoButton.style.display = "block";
    shortBreakVideoTimeout = setTimeout(() => {
      newShortBreakVideoButton.style.display = "none";
    }, 10000);
    handleNewShortBreakVideo();
  } else if (currentPhase === "break") {
    currentPhase = "focus";
    handleNewFocusVideo();
    newFocusVideoButton.style.display = "block";
    newShortBreakVideoButton.style.display = "none";
    secondsRemaining = FOCUS_MINUTES * SECONDS_IN_A_MINUTE;
    secondsInCurrentPhase = secondsRemaining;
  }
}

function updatePhaseNumber() {
  roundNumberContainer.innerHTML = `<h5>Round: ${roundNumber}/${NUM_ROUNDS}</h5>`;
}

// Update UI Sign in state changes
function updateSigninStatus(isSignedIn) {
  if (isSignedIn) {
    authorizeButton.style.display = "none";
    signoutButton.style.display = "block";
    progressBar.style.display = "block";
    content.style.display = "block";
    videoContainer.style.display = "block";
    initializeWebApp();
  } else {
    authorizeButton.style.display = "block";
    signoutButton.style.display = "none";
    progressBar.style.display = "none";
    skipButton.style.display = "none";
    pauseButton.style.display = "none";
    newFocusVideoButton.style.display = "none";
    content.style.display = "none";
    videoContainer.style.display = "none";
  }
}

function initializeWebApp() {
  getFocusVideos()
    .then(() => handleNewFocusVideo())
    .then(() => {
      pauseButton.style.display = "block";
      skipButton.style.display = "block";
      roundNumberContainer.style.display = "block";
      roundNumber = 0;
      updatePhaseNumber();
      newFocusVideoButton.style.display = "block";
      secondsRemaining = FOCUS_MINUTES * SECONDS_IN_A_MINUTE;
      secondsInCurrentPhase = secondsRemaining;
      currentPhase = "focus";
      timerPaused = false;
      playerSyncedWithTimer = true;
      timerInterval = setInterval(updateTimer, 1000);
      shortBreakVideoIndex = 0;
      return true;
    })
    .then(() => {
      getBreakVideos();
    });
}

function getFocusVideos() {
  return searchStudyVideos()
    .then(response => response.result.items)
    .then(videos => {
      focusVideoIds = videos.map(v => v.id.videoId);
      return focusVideoIds;
    });
}

function searchStudyVideos() {
  return gapi.client.youtube.search
    .list({
      maxResults: NUM_OF_MAX_RESULTS,
      part: "snippet",
      q: "study music",
      type: "video"
    })
    .then(response => {
      return response;
    });
}

function displayVideo(videoId) {
  if (player === undefined) {
    player = new YT.Player("player", {
      height: "360",
      width: "640",
      videoId: videoId,
      events: {
        onReady: onPlayerReady,
        onStateChange: onPlayerStateChange
      }
    });
  } else {
    player.cueVideoById(videoId);
    player.playVideo();
  }
  return true;
}

function onPlayerReady(event) {
  event.target.playVideo();
}

function onPlayerStateChange(event) {
  switch (event.data) {
    case YT.PlayerState.ENDED:
      if (currentPhase === "break") {
        clearTimer();
      } else if (currentPhase === "focus") {
        handleNewFocusVideo();
      }
      break;
    case YT.PlayerState.PLAYING:
      if (timerPaused && playerSyncedWithTimer) {
        handlePausePlayButton();
      }
      break;
    case YT.PlayerState.PAUSED:
      if (!timerPaused && playerSyncedWithTimer) {
        handlePausePlayButton();
      }
      break;
  }
}

function getBreakVideos() {
  getSubscriptions()
    .then(result =>
      result.map(channel => channel.snippet.resourceId.channelId).join(",")
    )
    .then(joinedIds =>
      gapi.client.youtube.channels.list({
        part: "contentDetails",
        id: joinedIds,
        maxResults: NUM_OF_MAX_RESULTS
      })
    )
    .then(response =>
      response.result.items.map(
        channel => channel.contentDetails.relatedPlaylists.uploads
      )
    )
    .then(playlistIds => getVideosFromPlaylists(playlistIds))
    .then(videos => videos.map(v => v.contentDetails.videoId))
    .then(videoIds => getRealVideoObjects(videoIds))
    .then(realVideos =>
      realVideos.map(v => {
        v.played = false;
        return v;
      })
    )
    .then(realVideos => {
      realVideos.sort(compareVideosByPublishDate);
      breakVideos = realVideos;
      skipButton.classList.remove("disabled");
      return realVideos;
    })
    .then(realVideos => {
      const filteredVideos = realVideos.filter(v =>
        filterVideoByMinuteLength(v, 5)
      );
      shortBreakVideos = filteredVideos;
    })
    .catch(err =>
      alert(`There was an issue getting the subscriptions: ${err}`)
    );
}

function getSubscriptions() {
  return gapi.client.youtube.subscriptions
    .list({
      part: "snippet,contentDetails",
      mine: true,
      maxResults: NUM_OF_MAX_RESULTS
    })
    .then(response => {
      return response.result.items;
    });
}

function getVideosFromPlaylists(playlistIds, index = 0, videos = []) {
  return gapi.client.youtube.playlistItems
    .list({
      part: "contentDetails",
      playlistId: playlistIds[index],
      maxResults: 5
    })
    .then(response => {
      response.result.items.forEach(videoId => videos.push(videoId));
      if (index + 1 != playlistIds.length) {
        return getVideosFromPlaylists(playlistIds, index + 1, videos);
      } else {
        return videos;
      }
    });
}

function getRealVideoObjects(
  videoIds,
  startIndex = 0,
  endIndex = NUM_OF_MAX_RESULTS,
  realVideos = []
) {
  const start = startIndex;
  const end = Math.min(videoIds.length, endIndex);
  const joinedIds = videoIds.slice(start, end).join(",");
  return gapi.client.youtube.videos
    .list({
      part: "snippet,contentDetails",
      id: joinedIds,
      maxResults: NUM_OF_MAX_RESULTS
    })
    .then(response => {
      realVideos = realVideos.concat(response.result.items);
      if (end != videoIds.length) {
        return getRealVideoObjects(
          videoIds,
          end,
          end + NUM_OF_MAX_RESULTS,
          realVideos
        );
      } else {
        return realVideos;
      }
    });
}

function compareVideosByPublishDate(a, b) {
  if (b.snippet.publishedAt < a.snippet.publishedAt) {
    return -1;
  }
  if (b.snippet.publishedAt > a.snippet.publishedAt) {
    return 1;
  }
  return 0;
}

function filterVideoByMinuteLength(video, minuteLength) {
  const minuteRegex = new RegExp(`T${minuteLength}M`);
  return minuteRegex.test(video.contentDetails.duration);
}

function getVideoLength(video) {
  const digitsRegex = /\d+/g;
  let timeMatches = video.contentDetails.duration.match(digitsRegex);
  timeMatches = timeMatches.map(match => parseInt(match));
  let numSeconds = 0;
  switch (timeMatches.length) {
    case 3:
      const [hours, minutes, seconds] = timeMatches;
      numSeconds += hours * Math.pow(SECONDS_IN_A_MINUTE, 2);
      numSeconds += minutes * SECONDS_IN_A_MINUTE;
      numSeconds += seconds;
      break;
    case 2:
      const [minutes, seconds] = timeMatches;
      numSeconds += minutes * SECONDS_IN_A_MINUTE;
      numSeconds += seconds;
      break;
    case 1:
      const [seconds] = timeMatches;
      numSeconds += seconds;
      break;
  }
  return numSeconds;
}
