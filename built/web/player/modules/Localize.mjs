import {EnvUtils} from '../utils/EnvUtils.mjs';
const TranslationMap = {
"extension_name": "Video Player",
  "extension_description": "Stream without buffering, a great video player and download accelerator all in one.",
  "extension_toggle_label": "Toggle",
  "welcome_page_title": "Welcome",
  "welcome_page_usage_header": "Usage",
  "welcome_page_usage_content0": "There are four ways to use",
  "welcome_page_usage_content1": "You can go to a website with a video stream, and turn faststream on by clicking on the icon. Play the stream and the client will be auto-replaced with FastStream",
  "welcome_page_usage_content2": "You can go to a new tab, and press the extension icon to go to the player.",
  "welcome_page_usage_content3": "If you have the option enabled, go to a mp4/mpd/m3u8 url and the player will play it.",
  "welcome_page_usage_content4": "Keep the player open in a new tab and it will collect sources as you browse elsewhere.",
  "welcome_page_usage_end": "Thank you for installing FastStream! Please let us know if you have any issues or suggestions.",
  "welcome_page_keybinds_header": "Default Keyboard Controls",
  "welcome_page_keybinds_content0": "You can change these keybinds in extension settings",
  "welcome_page_keybinds_content1": "arrow keys - 1 second seek forward/back",
  "welcome_page_keybinds_content2": "keys - 10 second seek forward/back",
  "welcome_page_keybinds_content3": "key - Undo seek",
  "welcome_page_keybinds_content4": "arrow keys - 10% volume up/down",
  "welcome_page_keybinds_content5": "- Full screen",
  "welcome_page_keybinds_content6": "- Add/decrease concurrent requests",
  "welcome_page_keybinds_content7": "- Force retry key - use this to re-attempt failed downloads",
  "welcome_page_keybinds_content8": "- Skip intro/outro if applicable",
  "welcome_page_keybinds_content9": "- Hide/show player",
  "perms_page_title": "FastStream Permissions",
  "perms_page_about_header": "About the Permissions Required by FastStream",
  "perms_page_about_content0": "In order for the extension to function, it needs to be able to have certain permissions. These permissions are only used for basic functionality.",
  "perms_page_about_content1": "We does not collect any data from you. It does not track you. It does not send any data to any servers. It does not even have a server to send data to.",
  "perms_page_about_content2": "QaQ",
  "perms_page_about_content3": "QaQ",
  "perms_page_breakdown_header": "Breakdown of Permissions",
  "perms_page_breakdown_content0": "Here is a breakdown of the permissions requires, and why it needs them.",
  "perms_page_breakdown_content1": "Note: The linked examples may refer to an older version of the code, but the gist should be the same overall. The list is not exhaustive, items are ordered by importance.",
  "perms_page_breakdown_perm1h": "Be able to access and modify all websites",
  "perms_page_breakdown_perm1d": "FastStream needs to be able to access all websites so that it can inject the player into the website directly. It injects a content script into websites you visit in order to:",
  "perms_page_breakdown_perm1r1": "Identify the largest visible video element to replace with the player.",
  "perms_page_breakdown_perm1r2": "Enable fullscreen permissions when the player is injected into a frame.",
  "perms_page_breakdown_perm1r3": "Scrape subtitle <track> elements from the page.",
  "perms_page_breakdown_perm2h": "Access the webRequest API",
  "perms_page_breakdown_perm2d": "We needs to be able to intercept HTTP requests to video sources in order to:",
  "perms_page_breakdown_perm2r1": "Identify video sources",
  "perms_page_breakdown_perm3h": "Access the declarativeNetRequest API",
  "perms_page_breakdown_perm3d": "We needs to be able to modify HTTP headers of select requests in order to:",
  "perms_page_breakdown_perm3r1": "Override headers for video sources.",
  "perms_page_breakdown_perm4h": "Store data on your browser",
  "perms_page_breakdown_perm4d": "We needs to be able to store data in your browser so that it can remember your settings.",
  "perms_page_breakdown_perm4r1": "General extension options.",
  "perms_page_breakdown_perm5h": "Access the tabs API",
  "perms_page_breakdown_perm5d": "We needs to be able to send messages between players and content scripts in each tab.",
  "perms_page_breakdown_perm5r1": "Sending sources to players from the background script.",
  "perms_page_granted": "Granted",
  "perms_page_notgranted": "Not Granted, click to grant",
  "player_skipintro": "Skip Intro",
  "player_skipoutro": "Skip Outro",
  "player_hidecontrols": "Hide Controls",
  "player_loading": "Loading...",
  "player_nosource_header": "No source is loaded!",
  "player_nosource_instruction1": "Drag and drop a video file to play it.",
  "player_nosource_instruction2p1": "Click",
  "player_nosource_instruction2p2": "to load sources detected from other tabs.",
  "player_playpause_label": "Play or pause video",
  "player_mute_label": "Mute audio",
  "player_timestamp_label": "Timestamp",
  "player_sourcesbrowser_title": "Sources Browser",
  "player_sourcesbrowser_toggle_label": "Toggle sources browser",
  "player_sourcesbrowser_closebtn_label": "Close sources browser",
  "player_audioconfig_title": "Audio Configuration",
  "player_audioconfig_toggle_label": "Toggle audio config window",
  "player_audioconfig_toggle_closebtn_label": "Close audio config window",
  "player_opensubtitles_title": "OpenSubtitles Search",
  "player_opensubtitles_closebtn_label": "Close OpenSubtitles search window",
  "player_opensubtitles_search_placeholder": "Search by title, filename, etc...",
  "player_opensubtitles_searchbtn": "Search",
  "player_opensubtitles_seasonnum": "Season #",
  "player_opensubtitles_episodenum": "Episode #",
  "player_opensubtitles_type_all": "All",
  "player_opensubtitles_type_movie": "Movie",
  "player_opensubtitles_type_episode": "Episode",
  "player_opensubtitles_language": "Language",
  "player_opensubtitles_year": "Year",
  "player_opensubtitles_sortby": "Sort By",
  "player_opensubtitles_sortby_downloads": "Downloads",
  "player_opensubtitles_sortby_date": "Upload Date",
  "player_opensubtitles_sortby_rating": "Rating",
  "player_opensubtitles_sortby_votes": "Votes",
  "player_opensubtitles_sort": "Sort",
  "player_opensubtitles_sort_desc": "Descending",
  "player_opensubtitles_sort_asc": "Ascending",
  "player_opensubtitles_searching": "Searching...",
  "player_opensubtitles_error": "Error: $1",
  "player_opensubtitles_disabled": "Cannot set proper headers! Install the extension to use this feature!",
  "player_opensubtitles_error_down": "OpenSubtitles is down!",
  "player_opensubtitles_down_alert": "OpenSubtitles download failed! Their servers are probably down!",
  "player_opensubtitles_noresults": "No results found!",
  "player_opensubtitles_quota": "OpenSubtitles limits subtitle downloads! You have no more downloads left! Your quota resets in $1",
  "player_opensubtitles_askopen": "Would you like to open the OpenSubtitles website to download the subtitle file manually?",
  "player_subtitlesmenu_toggle_label": "Toggle subtitles menu",
  "player_subtitlesmenu_backbtn": "Back",
  "player_subtitlesmenu_settings": "Subtitle Settings",
  "player_subtitlesmenu_testbtn": "Test Subtitles",
  "player_subtitlesmenu_testbtn_stop": "Stop Testing",
  "player_subtitlesmenu_uploadbtn": "Upload File",
  "player_subtitlesmenu_urlbtn": "From URL",
  "player_subtitlesmenu_urlprompt": "Enter URL",
  "player_subtitlesmenu_searchbtn": "Search OpenSubtitles",
  "player_subtitlesmenu_clearbtn": "Clear Subtitles",
  "player_subtitlesmenu_settingsbtn": "Subtitle Settings",
  "player_subtitlesmenu_resynctool_label": "Resync Tool",
  "player_subtitlesmenu_savetool_label": "Save subtitle file",
  "player_subtitlesmenu_removetool_label": "Remove subtitle track",
  "player_subtitlesmenu_shifttool_label": "Shift subtitles $1s",
  "player_testsubtitle": "This is a test subtitle",
  "player_qualitymenu_label": "Video quality",
  "player_playbackrate_label": "Playback rate",
  "player_settings_title": "FastStream Settings",
  "player_settings_closebtn_label": "Close settings window",
  "player_settings_label": "Settings",
  "player_savevideo_label": "Save video. hold ALT to save partial video. hold SHIFT to dump buffer.",
  "player_screenshot_label": "Take screenshot",
  "player_pip_label": "Picture in picture",
  "player_fullscreen_label": "Fullscreen",
  "player_fragment_failed_singular": "$1 Fragment Failed! Click to retry.",
  "player_fragment_failed_plural": "$1 Fragments Failed! Click to retry.",
  "player_fragment_allbuffered": "100% Buffered",
  "player_welcometext": "Welcome to FastStream v$1!",
  "player_nosource_alert": "No source is loaded!",
  "player_archive_loading": "Loading archive... $1%",
  "player_archive_loaded": "Loaded archive!",
  "player_archive_fail": "Failed to load archive!",
  "player_filename_prompt": "Enter a name for the file",
  "player_screenshot_saving": "Taking screenshot...",
  "player_screenshot_saved": "Screenshot saved!",
  "player_screenshot_fail": "Failed to take screenshot!",
  "player_savevideo_inprogress_alert": "Already making save!",
  "player_savevideo_unsupported": "Saving is not supported for this video!",
  "player_savevideo_partial_confirm": "Video has not finished downloading yet! Are you sure you want to save it?",
  "player_savevideo_incognito_confirm": "Incognito Mode will use RAM to buffer videos. Your computer may not have enough memory to save the entire video!\nAre you sure you want to proceed?",
  "player_savevideo_start": "Making save...",
  "player_savevideo_progress": "Saving $1%",
  "player_savevideo_fail": "Failed to save video!",
  "player_savevideo_failed_ask_archive": "Failed to save video!\nWould you like to archive the player's buffer storage instead?\n- Drag and drop archive files on the player to load it",
  "player_savevideo_complete": "Save complete!",
  "player_archiver_progress": "Archiving $1%",
  "player_archiver_saved": "Archive saved!",
  "player_quality_current": "(current)",
  "player_buffer_incognito_warning": "Not enough space to predownload in incognito mode, will buffer $1s",
  "player_buffer_storage_warning": "Not enough space to predownload, will buffer $1s",
  "player_error_drm": "Failed to load! DRM is not supported!",
  "player_error_load": "Failed to load video!",
  "player_source_autodetect": "Auto Detect",
  "player_source_direct": "Direct",
  "player_source_accelmp4": "Accelerated MP4",
  "player_source_accelhls": "Accelerated HLS",
  "player_source_acceldash": "Accelerated DASH",
  "player_source_accelyt": "Accelerated YouTube",
  "player_source_mode": "Mode",
  "player_source_url_placeholder": "Source URL",
  "player_source_headerbtn": "Header Override ($1)",
  "player_source_headerbtn_label": "Toggle header override input",
  "player_source_headerbtn_disabled": "Header Override (Extension Only)",
  "player_source_playbtn": "Play",
  "player_source_playbtn_playing": "Playing",
  "player_source_playbtn_loading": "Loading...",
  "player_source_deletebtn": "Delete",
  "player_source_headers_label": "Header override input",
  "player_source_headers_placeholder": "Header-Name: Header Value\nHeader2-Name: Header2 Value",
  "player_source_nonelisted": "No Sources Listed",
  "player_source_onelisted": "1 Source Listed",
  "player_source_multilisted": "$1 Sources Listed",
  "player_source_addbtn": "Add Source",
  "player_source_clearbtn": "Clear Sources",
  "player_audioconfig_duplicate_profile": "(loaded from file on $1)",
  "player_audioconfig_create_profile": "Create new profile",
  "player_audioconfig_import_profile": "Import profiles from file",
  "player_audioconfig_import_invalid": "Invalid profile file",
  "player_audioconfig_profile": "Profile",
  "player_audioconfig_profile_unnamed": "Unnamed Profile",
  "player_audioconfig_profile_load": "Load Profile",
  "player_audioconfig_profile_loaded": "Loaded Profile!",
  "player_audioconfig_profile_save": "Save Profile",
  "player_audioconfig_profile_saving": "Saving...",
  "player_audioconfig_profile_saved": "Saved Profile!",
  "player_audioconfig_profile_download": "Download Profile",
  "player_audioconfig_profile_downloaded": "Downloaded!",
  "player_audioconfig_profile_delete": "Delete",
  "player_audioconfig_profile_deleting": "Deleting...",
  "player_audioconfig_profile_deleted": "Deleted!",
  "audiomixer_title": "Audio Channel Mixer",
  "audiomixer_solo_label": "Solo",
  "audiomixer_mute_label": "Mute",
  "audiocompressor_title": "Audio Compressor",
  "audiocompressor_enabled": "Compressor Enabled",
  "audiocompressor_disabled": "Compressor Disabled",
  "audiocompressor_threshold": "Threshold",
  "audiocompressor_knee": "Knee",
  "audiocompressor_ratio": "Ratio",
  "audiocompressor_attack": "Attack",
  "audiocompressor_release": "Release",
  "audiocompressor_gain": "Gain",
  "audioeq_title": "Audio Equalizer",
  "audioeq_instructions": "Double click to change type",
  "audioeq_gain": "Gain: $1dB",
  "audioeq_qscroll": "Scroll to change Q",
  "options_title": "Options",
  "options_promo_header": "QQ",
  "options_promo_body": "We appreciate your feedback as it helps us to know where to improve. Please feel free tell us:",
  "options_promo_l1": "How you use it",
  "options_promo_l2": "Any bugs you encounter",
  "options_promo_l3": "Feature requests",
  "options_promo_end": "We also take accessibility very seriously. If you need accommodations that are lacking in the current version, please make a request and we will work on it ASAP.",
  "options_promo_rate": "OK I'll review FastStream",
  "options_promo_norate": "I don't want to review :(",
  "options_video_header": "Video Options",
  "options_video_body": "Applies CSS filters to the video. Doesn't work with picture-in-picture.",
  "options_video_brightness": "Brightness",
  "options_video_contrast": "Contrast",
  "options_video_saturation": "Saturation",
  "options_video_grayscale": "Grayscale",
  "options_video_sepia": "Sepia",
  "options_video_invert": "Invert",
  "options_video_hue": "Hue Rotate",
  "options_general_header": "General Options",
  "options_general_predownload": "Predownload entire video in the background if possible",
  "options_general_targetspeed": "Target download speed of predownloader",
  "options_general_freeunused": "Free unused channel buffers when switching quality levels",
  "options_general_analyze": "Automatically analyze sequential videos for intros/outros\n(turn off if you have CPU performance issues)",
  "options_general_autosub": "Automatically enable best found subtitle track\n(Change default language in subtitle settings)",
  "options_general_stream": "Use player to play HLS/DASH streams when opening playlist URLs (.m3u8/.mpd)",
  "options_general_mp4": "Use player to play MP4 videos when opening video URLs (.mp4)",
  "options_general_seekstep": "Seek keybind base step size (seconds)",
  "options_general_playbackrate": "Default playback rate",
  "options_general_clickpause": "Single click toggles play/pause",
  "options_keybinds_header": "Keyboard Shortcuts",
  "options_keybinds_body": "Keybinds are only active when the player is focused.",
  "options_keybinds_reset": "Reset to Defaults",
  "options_autourl_header": "Auto-enable URLs",
  "options_autourl_body": "Will automatically enable the extension upon visiting these URLs and disable upon leaving. One URL per line, pages starting with that URL will also match. For regex, prepend with a tilde (~). One regex per line.",
  "options_autourl_hint": "Hint: Test regex on",
  "options_help_header": "Help",
  "options_help_welcome": "Welcome Page",
  "options_help_issues": "Issue Tracker"
};
export class Localize {
  static getMessage(key, substitutions) {
    if (EnvUtils.isExtension()) {
      return chrome.i18n.getMessage(key, substitutions);
    }
    if (!Object.hasOwn(TranslationMap, key)) {
      return key;
    }
    // Replace $1, $2, etc. with substitutions
    let result = TranslationMap[key];
    substitutions = substitutions || [];
    for (let i = 0; i < substitutions.length; i++) {
      result = result.replace(`$${i + 1}`, substitutions[i]);
    }
    return result;
  }
}
