package ma.qalam.app;

import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.OpenableColumns;
import android.util.Base64;
import androidx.core.content.FileProvider;
import android.webkit.MimeTypeMap;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * Documents shared to the app from WhatsApp, e-mail, the gallery or a file manager («Share» → «قلم»):
 * they are copied into the app's own cache, then handed to the page, which opens the file import on them.
 * Nothing leaves the phone.
 */
@CapacitorPlugin(name = "ShareIn")
public class ShareInPlugin extends Plugin {
    private static final List<JSObject> PENDING = new ArrayList<>();
    private static final long MAX_BYTES = 40L * 1024 * 1024;

    /** The documents shared since the last call (path, name, type); they are given once. */
    @PluginMethod
    public void take(PluginCall call) {
        JSArray files = new JSArray();
        synchronized (PENDING) {
            for (JSObject o : PENDING) files.put(o);
            PENDING.clear();
        }
        JSObject r = new JSObject();
        r.put("files", files);
        call.resolve(r);
    }

    /** A document of a file (or a receipt) opened in the phone's viewer, or sent to another app (WhatsApp, e-mail…). */
    private Uri cached(PluginCall call) throws Exception {
        String data = call.getString("data", "");
        String name = call.getString("name", "document");
        if (data == null || data.isEmpty()) return null;
        name = name.replaceAll("[\\\\/:*?\"<>|]+", "-");
        File dir = new File(getContext().getCacheDir(), "out");
        File[] old = dir.listFiles();
        if (old != null) for (File f : old) if (System.currentTimeMillis() - f.lastModified() > 24 * 3600_000L) f.delete();
        dir.mkdirs();
        File f = new File(dir, name);
        try (OutputStream os = new FileOutputStream(f)) {
            os.write(Base64.decode(data, Base64.DEFAULT));
        }
        return FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", f);
    }

    @PluginMethod
    public void view(PluginCall call) {
        try {
            Uri u = cached(call);
            if (u == null) { call.reject("empty"); return; }
            Intent it = new Intent(Intent.ACTION_VIEW);
            it.setDataAndType(u, call.getString("mime", "application/octet-stream"));
            it.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(Intent.createChooser(it, call.getString("title", "فتح")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            call.resolve();
        } catch (Exception e) {
            call.reject("view_failed");
        }
    }

    @PluginMethod
    public void send(PluginCall call) {
        try {
            Uri u = cached(call);
            if (u == null) { call.reject("empty"); return; }
            Intent it = new Intent(Intent.ACTION_SEND);
            it.setType(call.getString("mime", "application/octet-stream"));
            it.putExtra(Intent.EXTRA_STREAM, u);
            String text = call.getString("text", "");
            if (text != null && !text.isEmpty()) it.putExtra(Intent.EXTRA_TEXT, text);
            it.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(Intent.createChooser(it, call.getString("title", "مشاركة")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            call.resolve();
        } catch (Exception e) {
            call.reject("send_failed");
        }
    }

    /** several documents sent together to another app (WhatsApp, e-mail…) */
    @PluginMethod
    public void sendMany(PluginCall call) {
        try {
            JSArray list = call.getArray("files");
            ArrayList<Uri> uris = new ArrayList<>();
            String mime = null;
            File dir = new File(getContext().getCacheDir(), "out");
            dir.mkdirs();
            for (int i = 0; list != null && i < list.length(); i++) {
                org.json.JSONObject o = list.getJSONObject(i);
                String data = o.optString("data", "");
                if (data.isEmpty()) continue;
                String name = o.optString("name", "document").replaceAll("[\\\\/:*?\"<>|]+", "-");
                String m = o.optString("mime", "application/octet-stream");
                File f = new File(dir, name);
                try (OutputStream os = new FileOutputStream(f)) {
                    os.write(Base64.decode(data, Base64.DEFAULT));
                }
                uris.add(FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", f));
                mime = mime == null ? m : (mime.equals(m) ? mime : (mime.split("/")[0].equals(m.split("/")[0]) ? mime.split("/")[0] + "/*" : "*/*"));
            }
            if (uris.isEmpty()) {
                call.reject("empty");
                return;
            }
            Intent it = new Intent(uris.size() == 1 ? Intent.ACTION_SEND : Intent.ACTION_SEND_MULTIPLE);
            it.setType(mime == null ? "*/*" : mime);
            if (uris.size() == 1) it.putExtra(Intent.EXTRA_STREAM, uris.get(0));
            else it.putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris);
            String text = call.getString("text", "");
            if (text != null && !text.isEmpty()) it.putExtra(Intent.EXTRA_TEXT, text);
            it.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(Intent.createChooser(it, call.getString("title", "مشاركة")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            call.resolve();
        } catch (Exception e) {
            call.reject("send_failed");
        }
    }

    @SuppressWarnings("deprecation")
    private static List<Uri> urisOf(Intent it) {
        List<Uri> out = new ArrayList<>();
        if (it == null || it.getAction() == null) return out;
        String a = it.getAction();
        try {
            if (Intent.ACTION_SEND.equals(a)) {
                Uri u = Build.VERSION.SDK_INT >= 33 ? it.getParcelableExtra(Intent.EXTRA_STREAM, Uri.class) : (Uri) it.getParcelableExtra(Intent.EXTRA_STREAM);
                if (u != null) out.add(u);
            } else if (Intent.ACTION_SEND_MULTIPLE.equals(a)) {
                ArrayList<Uri> l = Build.VERSION.SDK_INT >= 33 ? it.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri.class) : it.<Uri>getParcelableArrayListExtra(Intent.EXTRA_STREAM);
                if (l != null) out.addAll(l);
            }
        } catch (Exception ignored) {
        }
        if (out.isEmpty() && (Intent.ACTION_SEND.equals(a) || Intent.ACTION_SEND_MULTIPLE.equals(a))) {
            ClipData cd = it.getClipData();
            if (cd != null) for (int i = 0; i < cd.getItemCount(); i++) {
                Uri u = cd.getItemAt(i).getUri();
                if (u != null) out.add(u);
            }
        }
        if (out.size() > 12) return new ArrayList<>(out.subList(0, 12));
        return out;
    }

    /** A text shared to the app (a message, a paragraph of a judgment…): kept as a small text document, then handled like the others */
    private static boolean acceptText(Context ctx, Intent it, Runnable done) {
        if (it == null || !Intent.ACTION_SEND.equals(it.getAction())) return false;
        CharSequence cs = it.getCharSequenceExtra(Intent.EXTRA_TEXT);
        if (cs == null || cs.toString().trim().isEmpty()) return false;
        String text = cs.toString();
        if (text.length() > 400000) text = text.substring(0, 400000);
        String subject = it.getStringExtra(Intent.EXTRA_SUBJECT);
        try {
            File dir = new File(ctx.getApplicationContext().getCacheDir(), "shared");
            dir.mkdirs();
            File out = new File(dir, System.currentTimeMillis() + "-text.txt");
            try (OutputStream os = new FileOutputStream(out)) {
                os.write(text.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            }
            JSObject o = new JSObject();
            o.put("path", "file://" + out.getAbsolutePath());
            o.put("name", (subject != null && !subject.trim().isEmpty() ? subject.trim().replaceAll("[\\\\/:*?\"<>|]+", "-") : "نص مشارك") + ".txt");
            o.put("type", "text/plain");
            o.put("size", out.length());
            o.put("text", true);
            synchronized (PENDING) {
                PENDING.add(o);
            }
            if (done != null) done.run();
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private static String nameOf(Context ctx, Uri u) {
        String n = null;
        try (Cursor c = ctx.getContentResolver().query(u, new String[] {OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (c != null && c.moveToFirst()) n = c.getString(0);
        } catch (Exception ignored) {
        }
        if (n == null || n.isEmpty()) n = u.getLastPathSegment();
        return n == null ? "document" : n;
    }

    /** Reads the documents of a «Share» intent in the background; true when the intent carried any. */
    static boolean accept(Context ctx, Intent it, Runnable done) {
        final List<Uri> uris = urisOf(it);
        if (uris.isEmpty()) return acceptText(ctx, it, done);
        final String itype = it.getType();
        final Context app = ctx.getApplicationContext();
        new Thread(() -> {
            File dir = new File(app.getCacheDir(), "shared");
            File[] old = dir.listFiles();
            if (old != null) for (File f : old) if (System.currentTimeMillis() - f.lastModified() > 6 * 3600_000L) f.delete();
            dir.mkdirs();
            List<JSObject> got = new ArrayList<>();
            int i = 0;
            for (Uri u : uris) {
                try {
                    String type = app.getContentResolver().getType(u);
                    if (type == null || type.equals("*/*")) type = itype;
                    String name = nameOf(app, u);
                    String ext = "";
                    int dot = name.lastIndexOf('.');
                    if (dot > 0 && name.length() - dot <= 6) ext = name.substring(dot);
                    else if (type != null) {
                        String e = MimeTypeMap.getSingleton().getExtensionFromMimeType(type);
                        if (e != null) ext = "." + e;
                    }
                    File out = new File(dir, System.currentTimeMillis() + "-" + (i++) + ext);
                    long n = 0;
                    try (InputStream in = app.getContentResolver().openInputStream(u); OutputStream os = new FileOutputStream(out)) {
                        if (in == null) continue;
                        byte[] b = new byte[65536];
                        int k;
                        while ((k = in.read(b)) > 0) {
                            n += k;
                            if (n > MAX_BYTES) break;
                            os.write(b, 0, k);
                        }
                    }
                    if (n == 0 || n > MAX_BYTES) {
                        out.delete();
                        continue;
                    }
                    JSObject o = new JSObject();
                    o.put("path", "file://" + out.getAbsolutePath());
                    o.put("name", name);
                    o.put("type", type == null ? "" : type);
                    o.put("size", n);
                    got.add(o);
                } catch (Exception ignored) {
                }
            }
            synchronized (PENDING) {
                PENDING.addAll(got);
            }
            if (!got.isEmpty() && done != null) done.run();
        }).start();
        return true;
    }
}
