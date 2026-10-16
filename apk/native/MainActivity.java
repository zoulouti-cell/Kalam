package ma.qalam.app;

import android.content.Intent;
import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CalendarPlugin.class);
        registerPlugin(FileSaverPlugin.class);
        registerPlugin(ShareInPlugin.class);
        super.onCreate(savedInstanceState);
        // A document shared to the app («Share» → «قلم») while it was closed.
        if (savedInstanceState == null) takeShared(getIntent());
        // Back button and back gesture: the page goes back one step (sheet, library level, tab) before leaving the app.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (getBridge() == null || getBridge().getWebView() == null) {
                    moveTaskToBack(true);
                    return;
                }
                getBridge().getWebView().evaluateJavascript(
                    "(function(){try{return window.milafBack?window.milafBack():false;}catch(e){return false;}})()",
                    value -> {
                        if (!"true".equals(value)) moveTaskToBack(true);
                    });
            }
        });
    }

    // A document shared to the app while it was open.
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        takeShared(intent);
    }

    private void takeShared(Intent intent) {
        boolean any = ShareInPlugin.accept(this, intent, () -> runOnUiThread(() -> {
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().evaluateJavascript(
                    "(function(){try{if(window.milafShareIn)window.milafShareIn();}catch(e){}})()", null);
            }
        }));
        if (any) setIntent(new Intent(Intent.ACTION_MAIN));
    }
}
