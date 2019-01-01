var GoogleAuth;

const CLIENT_ID =
  "263383866383-1mgpakgpgqilo2v3aoc7kj3eane6enla.apps.googleusercontent.com";
const DISCOVERY_DOCS = [
  "https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest"
];
const SCOPES = "https://www.googleapis.com/auth/youtube.readonly";

const authorizeButton = document.getElementById("authorize-button");
const signoutButton = document.getElementById("signout-button");
const content = document.getElementById("content");
const channelForm = document.getElementById("channel-form");
const channelInput = document.getElementById("channel-input");
const videoContainer = document.getElementById("video-container");

const NUM_OF_MAX_RESULTS = 50;

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

// Update UI Sign in state changes
function updateSigninStatus(isSignedIn) {
  if (isSignedIn) {
    authorizeButton.style.display = "none";
    signoutButton.style.display = "block";
    content.style.display = "block";
    videoContainer.style.display = "block";
    displayStudyVideo();
  } else {
    authorizeButton.style.display = "block";
    signoutButton.style.display = "none";
    content.style.display = "none";
    videoContainer.style.display = "none";
  }
}

function displayStudyVideo() {
  searchStudyVideo().then(response => console.log(response));
}

function searchStudyVideo() {
  gapi.client.youtube.search.list({
    maxResults: 25,
    part: "snippet",
    q: "study music"
  }).then(response => {
    return response
  })
}

function displayBreakVideo() {
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
      return filteredVideos;
    })
    .then(filteredVideos => {
      videoContainer.innerHTML = `<iframe id="ytplayer" type="text/html" width="640" height="360"
    src="https://www.youtube.com/embed/${filteredVideos[0].id}?autoplay=1"
    frameborder="0"></iframe>
  `;
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
