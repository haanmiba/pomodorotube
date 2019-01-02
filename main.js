var GoogleAuth;

const CLIENT_ID =
  "263383866383-1mgpakgpgqilo2v3aoc7kj3eane6enla.apps.googleusercontent.com";
const DISCOVERY_DOCS = [
  "https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest"
];
const SCOPES = "https://www.googleapis.com/auth/youtube.readonly";

const NUM_OF_MAX_RESULTS = 50;
const NUM_ROUNDS = 4;
const SECONDS_IN_A_MINUTE = 20;

const authorizeButton = document.getElementById("authorize-button");
const signoutButton = document.getElementById("signout-button");
const newFocusVideoButton = document.getElementById("new-focus-video-button");
const newShortBreakVideoButton = document.getElementById(
  "new-short-break-video-button"
);
const content = document.getElementById("content");
const channelForm = document.getElementById("channel-form");
const channelInput = document.getElementById("channel-input");
const timerContainer = document.getElementById("timer-container");
const videoContainer = document.getElementById("video-container");
const roundNumberContainer = document.getElementById("round-number-container");

var currentPhase;
var secondsRemaining;
var timerInterval;
var roundNumber;

var focusVideoIds;
var breakVideos;
var shortBreakVideos;
var shortBreakVideoIndex;

// Load auth2 library
function handleClientLoad() {
  gapi.load("client:auth2", initClient);
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

      authorizeButton.onclick = handleAuthClick;
      signoutButton.onclick = handleSignoutClick;
      newFocusVideoButton.onclick = handleNewFocusVideo;
    });
}

// Sign in the user upon button click
function handleAuthClick(event) {
  GoogleAuth.signIn();
}

// Sign out the user upon button click
function handleSignoutClick(event) {
  GoogleAuth.signOut();
}

function handleNewFocusVideo(event = undefined) {
  const videoId =
    focusVideoIds[Math.floor(Math.random() * focusVideoIds.length)];
  displayVideo(videoId);
  return true;
}

function handleNewShortBreakVideo(event = undefined) {
  const videoId = shortBreakVideos[shortBreakVideoIndex++].id;
  displayVideo(videoId);
  return true;
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

  secondsRemaining--;
  if (secondsRemaining < 0) {
    clearTimer();
  }
}

function clearTimer() {
  timerContainer.innerHTML = "";
  clearInterval(timerInterval);
  switchPhase();
  timerInterval = setInterval(updateTimer, 1000);
}

function switchPhase() {
  if (currentPhase === "focus") {
    roundNumber++;
    updatePhaseNumber();
    currentPhase = "break";
    newFocusVideoButton.style.display = "none";
    newShortBreakVideoButton.style.display = "block";
    setTimeout(() => {
      newShortBreakVideoButton.style.display = "none";
    }, 10000);
    handleNewShortBreakVideo();
    secondsRemaining = 1 * SECONDS_IN_A_MINUTE;
  } else if (currentPhase === "break") {
    currentPhase = "focus";
    handleNewFocusVideo();
    console.log("BACK TO WORK!");
    newFocusVideoButton.style.display = "block";
    secondsRemaining = 1 * SECONDS_IN_A_MINUTE;
  }
}

function updatePhaseNumber() {
  roundNumberContainer.innerHTML = `<p>Round: ${roundNumber}/${NUM_ROUNDS}</p>`;
}

// Update UI Sign in state changes
function updateSigninStatus(isSignedIn) {
  if (isSignedIn) {
    authorizeButton.style.display = "none";
    signoutButton.style.display = "block";
    content.style.display = "block";
    videoContainer.style.display = "block";
    initializeWebApp();
  } else {
    authorizeButton.style.display = "block";
    signoutButton.style.display = "none";
    newFocusVideoButton.style.display = "none";
    content.style.display = "none";
    videoContainer.style.display = "none";
  }
}

function initializeWebApp() {
  getFocusVideos()
    .then(() => handleNewFocusVideo())
    .then(() => {
      roundNumberContainer.style.display = "block";
      roundNumber = 0;
      updatePhaseNumber();
      newFocusVideoButton.style.display = "block";
      secondsRemaining = 1 * SECONDS_IN_A_MINUTE;
      currentPhase = "focus";
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
  videoContainer.innerHTML = `<iframe id="ytplayer" type="text/html" width="640" height="360"
  src="https://www.youtube.com/embed/${videoId}?autoplay=1"
  frameborder="0"></iframe>`;
  return true;
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
      console.log(breakVideos);
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
      response.result.items.forEach(video => realVideos.push(video));
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
