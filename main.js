var GoogleAuth;

const CLIENT_ID =
  "263383866383-1mgpakgpgqilo2v3aoc7kj3eane6enla.apps.googleusercontent.com";
const DISCOVERY_DOCS = [
  "https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest"
];
const SCOPES = "https://www.googleapis.com/auth/youtube.readonly";
const NUM_OF_MAX_RESULTS = 50;

const authorizeButton = document.getElementById("authorize-button");
const signoutButton = document.getElementById("signout-button");
const newVideoButton = document.getElementById("new-video-button");
const content = document.getElementById("content");
const channelForm = document.getElementById("channel-form");
const channelInput = document.getElementById("channel-input");
const timerContainer = document.getElementById("timer-container");
const videoContainer = document.getElementById("video-container");

var currentPhase;
var secondsRemaining;
var timerInterval;
var focusVideoIds;
var breakVideos;

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
      newVideoButton.onclick = handleNewFocusVideo;
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

function handleNewBreakVideo(event = undefined) {
  const videoId = breakVideos[0].id;
  displayVideo(videoId);
  return true;
}

function updateTimer() {
  let minutes = Math.floor(secondsRemaining / 60);
  let seconds = secondsRemaining - minutes * 60;

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
  handleNewBreakVideo();
}

// Update UI Sign in state changes
function updateSigninStatus(isSignedIn) {
  if (isSignedIn) {
    authorizeButton.style.display = "none";
    signoutButton.style.display = "block";
    content.style.display = "block";
    videoContainer.style.display = "block";
    getFocusVideos()
      .then(() => handleNewFocusVideo())
      .then(() => {
        newVideoButton.style.display = "block";
        secondsRemaining = 1 * 60;
        timerInterval = setInterval(updateTimer, 1000);
        return true;
      })
      .then(() => {
        getBreakVideos();
      });
  } else {
    authorizeButton.style.display = "block";
    signoutButton.style.display = "none";
    newVideoButton.style.display = "none";
    content.style.display = "none";
    videoContainer.style.display = "none";
  }
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
  videoContainer.innerHTML = `<iframe id="ytplayer" type="text/html" width="75vm" 
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
    .then(playlistIds => getVideos(playlistIds))
    .then(videos => videos.map(v => v.contentDetails.videoId))
    .then(videoIds => getRealVideoObjects(videoIds))
    .then(realVideos => {
      realVideos.sort(compareVideosByPublishDate);
      return realVideos;
    })
    .then(realVideos => {
      const filteredVideos = realVideos.filter(v =>
        filterVideoByMinuteLength(v, 5)
      );
      breakVideos = filteredVideos;
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

function getVideos(playlistIds, index = 0, videos = []) {
  return gapi.client.youtube.playlistItems
    .list({
      part: "contentDetails",
      playlistId: playlistIds[index],
      maxResults: 5
    })
    .then(response => {
      response.result.items.forEach(videoId => videos.push(videoId));
      if (index + 1 != playlistIds.length) {
        return getVideos(playlistIds, index + 1, videos);
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
