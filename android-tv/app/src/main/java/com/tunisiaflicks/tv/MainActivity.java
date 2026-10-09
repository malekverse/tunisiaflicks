package com.tunisiaflicks.tv;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.SslErrorHandler;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import android.window.OnBackInvokedDispatcher;

import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

/**
 * TunisiaFlicks on an Android TV or a TV box: one WebView on the site in TV mode.
 *
 * The site does the rest (the remote-friendly shell, signing in from a phone at /activate). This
 * app only keeps the WebView to the site: top-level navigations to any other host are cancelled,
 * no new windows, no file or content access, no mixed content, no JavaScript interface, every
 * permission and every bad certificate refused. Players inside iframes still load.
 *
 * Back asks the page first (window.tfTvBack(): closes the player menu or a sheet, true when it
 * did), then goes back in history, then leaves the app.
 */
public class MainActivity extends Activity {

    /** Older WebViews can't run the site (modern JavaScript and CSS). */
    private static final int MIN_WEBVIEW_MAJOR = 100;
    private static final String WEBVIEW_PACKAGE = "com.google.android.webview";

    private FrameLayout root;
    private WebView webView;
    private View customView;
    private WebChromeClient.CustomViewCallback customViewCallback;
    private View notice;
    private boolean backPending;
    private final Handler handler = new Handler(Looper.getMainLooper());
    /** A page that never answers (busy, or navigating) mustn't swallow every later Back. */
    private final Runnable backTimeout = () -> backPending = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        setContentView(root);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            // Android 13+: Back arrives here (from Android 16 on, never as a key event).
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::back);
        }

        int major = webViewMajorVersion();
        if (major >= 0 && major < MIN_WEBVIEW_MAJOR) {
            showOldWebView(major);
            return;
        }
        startSite(savedInstanceState);
    }

    // --- The WebView ------------------------------------------------------------------------

    @SuppressLint("SetJavaScriptEnabled")
    private void startSite(Bundle savedInstanceState) {
        hideNotice();
        webView = new WebView(this);
        webView.setBackgroundColor(Color.BLACK);
        root.addView(webView, 0, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        // Trailers and the player start from the remote's OK, which isn't always a "gesture".
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setGeolocationEnabled(false);
        settings.setSupportZoom(false);
        // The site recognizes the app by this suffix (it hides "Exit TV mode" and the app panel).
        settings.setUserAgentString(settings.getUserAgentString() + " TunisiaFlicksTV/" + BuildConfig.VERSION_NAME);
        if (WebViewFeature.isFeatureSupported(WebViewFeature.SAFE_BROWSING_ENABLE)) {
            WebSettingsCompat.setSafeBrowsingEnabled(settings, true);
        }

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        // The players are embedded from other sites; they need their own cookies.
        cookies.setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new SiteClient());
        webView.setWebChromeClient(new SiteChrome());

        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) {
            webView.loadUrl(BuildConfig.START_URL);
        }
        webView.requestFocus();
    }

    /** True for an https address on the site itself (exactly its host, no subdomain). */
    private static boolean onSite(Uri uri) {
        return uri != null && "https".equals(uri.getScheme()) && BuildConfig.SITE_HOST.equals(uri.getHost());
    }

    private final class SiteClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            // Frames (the players) may go where they need to; the page itself stays on the site.
            if (!request.isForMainFrame()) return false;
            return refuse(request.getUrl());
        }

        @Override
        @SuppressWarnings("deprecation")
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            // Android 5 and 6, where only top-level navigations get here.
            return refuse(Uri.parse(url));
        }

        private boolean refuse(Uri uri) {
            if (onSite(uri)) return false;
            Toast.makeText(MainActivity.this, R.string.blocked_link, Toast.LENGTH_LONG).show();
            return true;
        }

        @Override
        public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
            handler.cancel();
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request.isForMainFrame()) showOffline();
        }

        @Override
        @SuppressWarnings("deprecation")
        public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
            // Android 5: only the main frame's errors arrive here.
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) showOffline();
        }

        @Override
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            // The page's renderer crashed or was killed for memory: start over instead of crashing.
            root.removeView(view);
            view.destroy();
            if (view == webView) {
                webView = null;
                startSite(null);
            }
            return true;
        }
    }

    private final class SiteChrome extends WebChromeClient {
        @Override
        public void onPermissionRequest(PermissionRequest request) {
            request.deny();
        }

        @Override
        public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
            callback.invoke(origin, false, false);
        }

        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            return false;
        }

        @Override
        public void onShowCustomView(View view, CustomViewCallback callback) {
            // Full screen video (the player's Start, or a trailer's full screen button).
            if (customView != null) {
                callback.onCustomViewHidden();
                return;
            }
            customView = view;
            customViewCallback = callback;
            root.addView(view, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            if (webView != null) webView.setVisibility(View.GONE);
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            immersive();
        }

        @Override
        public void onHideCustomView() {
            leaveFullScreen();
        }
    }

    private void leaveFullScreen() {
        if (customView == null) return;
        root.removeView(customView);
        customView = null;
        if (customViewCallback != null) customViewCallback.onCustomViewHidden();
        customViewCallback = null;
        if (webView != null) {
            webView.setVisibility(View.VISIBLE);
            webView.requestFocus();
        }
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    // --- Back -------------------------------------------------------------------------------

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        // Android 12 and older (most TV boxes): Back is a key event.
        if (event.getKeyCode() != KeyEvent.KEYCODE_BACK || Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) return super.dispatchKeyEvent(event);
        if (event.getAction() == KeyEvent.ACTION_UP && !event.isCanceled()) back();
        return true;
    }

    private void back() {
        if (customView != null) {
            leaveFullScreen();
            return;
        }
        if (webView == null || notice != null) {
            finish();
            return;
        }
        if (backPending) return;
        backPending = true;
        handler.postDelayed(backTimeout, 1500);
        // The page closes its own layers first; it answers "true" when it did.
        webView.evaluateJavascript("(function(){try{return !!(window.tfTvBack&&window.tfTvBack())}catch(e){return false}})()", result -> {
            handler.removeCallbacks(backTimeout);
            backPending = false;
            if (BuildConfig.DEBUG) Log.d("TunisiaFlicksTV", "back: page answered " + result + ", canGoBack " + (webView != null && webView.canGoBack()));
            if ("true".equals(result) || webView == null) return;
            if (webView.canGoBack()) webView.goBack();
            else finish();
        });
    }

    // --- Notices (old WebView, offline) -----------------------------------------------------

    /** The major version of the WebView the device uses, or -1 when it can't be told. */
    private int webViewMajorVersion() {
        PackageInfo info = WebViewCompat.getCurrentWebViewPackage(this);
        if (info == null || info.versionName == null) return -1;
        String name = info.versionName;
        int end = 0;
        while (end < name.length() && Character.isDigit(name.charAt(end))) end++;
        if (end == 0) return -1;
        try {
            return Integer.parseInt(name.substring(0, end));
        } catch (NumberFormatException e) {
            return -1;
        }
    }

    private void showOldWebView(int major) {
        Button update = button(R.string.webview_update);
        update.setOnClickListener(v -> openStore());
        Button anyway = button(R.string.webview_continue);
        anyway.setOnClickListener(v -> startSite(null));
        showNotice(getString(R.string.webview_old_title), getString(R.string.webview_old_text, major), update, anyway);
    }

    private void showOffline() {
        if (notice != null) return;
        Button retry = button(R.string.offline_retry);
        retry.setOnClickListener(v -> {
            hideNotice();
            if (webView != null) {
                webView.setVisibility(View.VISIBLE);
                webView.reload();
                webView.requestFocus();
            }
        });
        if (webView != null) webView.setVisibility(View.INVISIBLE);
        showNotice(getString(R.string.offline_title), getString(R.string.offline_text), retry, null);
    }

    private void openStore() {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + WEBVIEW_PACKAGE)));
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, R.string.webview_no_store, Toast.LENGTH_LONG).show();
        }
    }

    private Button button(int text) {
        Button button = new Button(this);
        button.setText(text);
        button.setAllCaps(false);
        button.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        return button;
    }

    private void showNotice(String title, String text, Button primary, Button secondary) {
        hideNotice();
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        int pad = dp(48);
        box.setPadding(pad, pad, pad, pad);
        box.setBackgroundColor(Color.BLACK);

        TextView heading = new TextView(this);
        heading.setText(title);
        heading.setTextColor(Color.WHITE);
        heading.setTextSize(TypedValue.COMPLEX_UNIT_SP, 30);
        heading.setGravity(Gravity.CENTER);
        box.addView(heading);

        TextView body = new TextView(this);
        body.setText(text);
        body.setTextColor(0xB3FFFFFF);
        body.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        body.setGravity(Gravity.CENTER);
        body.setMaxWidth(dp(640));
        body.setPadding(0, dp(16), 0, dp(32));
        box.addView(body);

        LinearLayout buttons = new LinearLayout(this);
        buttons.setGravity(Gravity.CENTER);
        buttons.addView(primary);
        if (secondary != null) {
            LinearLayout.LayoutParams gap = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            gap.setMarginStart(dp(16));
            buttons.addView(secondary, gap);
        }
        box.addView(buttons);

        notice = box;
        root.addView(box, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        primary.requestFocus();
    }

    private void hideNotice() {
        if (notice == null) return;
        root.removeView(notice);
        notice = null;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    // --- Lifecycle --------------------------------------------------------------------------

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) immersive();
    }

    @SuppressWarnings("deprecation")
    private void immersive() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) webView.saveState(outState);
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (webView != null) webView.onPause();
        CookieManager.getInstance().flush();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            root.removeView(webView);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
