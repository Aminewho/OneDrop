const { contextBridge } = require("electron");

try {
	if (window.location.href.startsWith("http://localhost:8081")) {
		[
			"videoSearchQuery_page",
			"videoResults_page",
			"videoTaskStatuses_page",
			"videoSearchQuery",
			"videoResults",
			"videoTaskStatuses",
			"youtubeSearchQuery_session",
			"youtubeResults_session",
			"youtubeTaskStatuses_session"
		].forEach((key) => localStorage.removeItem(key));

		[
			"youtubeSearchQuery_session",
			"youtubeResults_session",
			"youtubeTaskStatuses_session",
			"spotify_search_page_state_v1"
		].forEach((key) => sessionStorage.removeItem(key));
	}
} catch (error) {
	console.error("Unable to reset YouTube page state:", error);
}

contextBridge.exposeInMainWorld("oneDrop", {

});