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

const defaultChannel = "techguyweb";

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
    .then(function() {
      GoogleAuth = gapi.auth2.getAuthInstance();

      // Listen for sign in state changes
      GoogleAuth.isSignedIn.listen(updateSigninStatus);

      // Handle initial sign in state
      updateSigninStatus(GoogleAuth.isSignedIn.get());

      authorizeButton.onclick = handleAuthClick;
      signoutButton.onclick = handleSignoutClick;
    });
}

// Update UI Sign in state changes
function updateSigninStatus(isSignedIn) {
  if (isSignedIn) {
    authorizeButton.style.display = "none";
    signoutButton.style.display = "block";
    content.style.display = "block";
    videoContainer.style.display = "block";
    var subscriptionChannels = [];
    getSubscriptions("", subscriptionChannels)
      .then(result => {
        console.log(
          result.forEach(channel => console.log(channel.snippet.title))
        );
      })
      .catch(err =>
        alert(`There was an issue getting the subscriptions: ${err}`)
      );
  } else {
    authorizeButton.style.display = "block";
    signoutButton.style.display = "none";
    content.style.display = "none";
    videoContainer.style.display = "none";
  }
}

// Sign in the user upon button click
function handleAuthClick(event) {
  GoogleAuth.signIn();
}

// Sign out the user upon button click
function handleSignoutClick(event) {
  GoogleAuth.signOut();
}

function createResource(properties) {
  var resource = {};
  var normalizedProps = properties;
  for (var p in properties) {
    var value = properties[p];
    if (p && p.substr(-2, 2) == "[]") {
      var adjustedName = p.replace("[]", "");
      if (value) {
        normalizedProps[adjustedName] = value.split(",");
      }
      delete normalizedProps[p];
    }
  }
  for (var p in normalizedProps) {
    // Leave properties that don't have values out of inserted resource.
    if (normalizedProps.hasOwnProperty(p) && normalizedProps[p]) {
      var propArray = p.split(".");
      var ref = resource;
      for (var pa = 0; pa < propArray.length; pa++) {
        var key = propArray[pa];
        if (pa == propArray.length - 1) {
          ref[key] = normalizedProps[p];
        } else {
          ref = ref[key] = ref[key] || {};
        }
      }
    }
  }
  return resource;
}

function removeEmptyParams(params) {
  for (var p in params) {
    if (!params[p] || params[p] == "undefined") {
      delete params[p];
    }
  }
  return params;
}

function executeRequest(request) {
  request.execute(function(response) {
    console.log(response);
    return response;
  });
}

function buildApiRequest(requestMethod, path, params, properties) {
  params = removeEmptyParams(params);
  var request;
  if (properties) {
    var resource = createResource(properties);
    request = gapi.client.request({
      body: resource,
      method: requestMethod,
      path: path,
      params: params
    });
  } else {
    request = gapi.client.request({
      method: requestMethod,
      path: path,
      params: params
    });
  }
  return executeRequest(request);
}

function showChannelData(data) {
  const channelData = document.getElementById("channel-data");
  channelData.innerHTML = data;
}

function getSubscriptions(nextPageToken, subscriptionList) {
  return gapi.client.youtube.subscriptions
    .list({
      part: "snippet,contentDetails",
      mine: true,
      maxResults: 50,
      pageToken: nextPageToken
    })
    .then(response => {
      response.result.items.forEach(subscription =>
        subscriptionList.push(subscription)
      );
      if (response.result.nextPageToken) {
        return getSubscriptions(
          response.result.nextPageToken,
          subscriptionList
        );
      } else {
        return subscriptionList;
      }
    });
}

/*
function getSubscriptions() {
  const subscriptionChannels = [];
  var nextPageToken = "";
  do {
    gapi.client.youtube.subscriptions
      .list({
        part: "snippet,contentDetails",
        mine: true,
        maxResults: 50,
        pageToken: nextPageToken
      })
      .then(response => {
        console.log(response);
        console.log(response.result);
        nextPageToken = response.result.nextPageToken;
        console.log(nextPageToken);
      })
      .catch(err =>
        alert("There was an issue fetching your subscriptions: " + err)
      );
  } while (nextPageToken);
  console.log("OUTISDE " + nextPageToken);
}
*/

// Get channel from API
function getCurrentChannel() {
  console.log("test");
  gapi.client.youtube.channels
    .list({
      part: "snippet,contentDetails,statistics",
      mine: true
    })
    .then(response => {
      const channel = response.result.items[0];
      const output = `
        <ul class="collection">
          <li class="collection-item">Title: ${channel.snippet.title}</li>
          <li class="collection-item">ID: ${channel.id}</li>
          <li class="collection-item">Subscribers: ${
            channel.statistics.subscriberCount
          }</li>
          <li class="collection-item">Views: ${
            channel.statistics.viewCount
          }</li>
          <li class="collection-item">Videos: ${
            channel.statistics.videoCount
          }</li>
        </ul>
        <p>${channel.snippet.description}</p>
        <hr>
        <a class="btn grey darken-2" target="_blank" href="https://youtube.com/${
          channel.snippet.customUrl
        }">Visit Channel</a>
        `;
      showChannelData(output);
    })
    .catch(err => alert("No channel by that name."));
}
