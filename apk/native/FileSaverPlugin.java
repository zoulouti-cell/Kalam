package ma.qalam.app;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.ContentResolver;
import android.content.ClipData;
import android.content.ContentValues;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.UriPermission;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.DocumentsContract;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.Scope;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Collections;

@CapacitorPlugin(name = "FileSaver")
public class FileSaverPlugin extends Plugin {

    // ---------- Google Drive: the access of the app to the files it puts in the lawyer's Drive (scope drive.file), given by Google Play services ----------
    private static final String DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
    private ActivityResultLauncher<IntentSenderRequest> authLauncher;
    private PluginCall authCall;

    @Override
    public void load() {
        try {
            authLauncher = getActivity().registerForActivityResult(new ActivityResultContracts.StartIntentSenderForResult(), res -> {
                PluginCall c = authCall;
                authCall = null;
                if (c == null) return;
                try {
                    if (res.getResultCode() != Activity.RESULT_OK || res.getData() == null) {
                        c.reject("cancelled");
                        return;
                    }
                    AuthorizationResult r = Identity.getAuthorizationClient(getActivity()).getAuthorizationResultFromIntent(res.getData());
                    JSObject o = new JSObject();
                    o.put("token", r.getAccessToken());
                    c.resolve(o);
                } catch (Exception e) {
                    c.reject("auth_failed");
                }
            });
        } catch (Exception e) {
            authLauncher = null;
        }
    }

    /** an access token for Drive; the first time Google asks the lawyer to agree (interactive), afterwards it is given silently */
    @PluginMethod
    public void driveToken(PluginCall call) {
        final boolean interactive = Boolean.TRUE.equals(call.getBoolean("interactive", true));
        try {
            AuthorizationRequest req = AuthorizationRequest.builder()
                    .setRequestedScopes(Collections.singletonList(new Scope(DRIVE_SCOPE)))
                    .build();
            Identity.getAuthorizationClient(getActivity()).authorize(req)
                    .addOnSuccessListener(r -> {
                        if (r.hasResolution()) {
                            PendingIntent pi = r.getPendingIntent();
                            if (!interactive || authLauncher == null || pi == null) {
                                call.reject("needs_consent");
                                return;
                            }
                            authCall = call;
                            authLauncher.launch(new IntentSenderRequest.Builder(pi.getIntentSender()).build());
                        } else {
                            JSObject o = new JSObject();
                            o.put("token", r.getAccessToken());
                            call.resolve(o);
                        }
                    })
                    .addOnFailureListener(e -> call.reject("auth_failed"));
        } catch (Exception e) {
            call.reject("auth_failed");
        }
    }

    @PluginMethod
    public void savePdf(PluginCall call) {
        try {
            String data = call.getString("data", "");
            String name = call.getString("name", "document.pdf");
            if (data == null || data.length() == 0) {
                call.reject("empty");
                return;
            }
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                call.reject("unsupported");
                return;
            }
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            ContentResolver resolver = getContext().getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
            values.put(MediaStore.MediaColumns.MIME_TYPE, "application/pdf");
            values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
            Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) {
                call.reject("insert_failed");
                return;
            }
            OutputStream out = resolver.openOutputStream(uri);
            if (out == null) {
                call.reject("stream_failed");
                return;
            }
            out.write(bytes);
            out.flush();
            out.close();
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setDataAndType(uri, "application/pdf");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                getActivity().startActivity(intent);
            } catch (Exception viewerMissing) {
                // the file stays in Downloads even when no PDF viewer is installed
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("save_failed");
        }
    }

    @PluginMethod
    public void saveFile(PluginCall call) {
        try {
            String data = call.getString("data", "");
            String name = call.getString("name", "file.bin");
            String mime = call.getString("mime", "application/octet-stream");
            String folder = call.getString("folder", "Qalam");
            if (data == null || data.length() == 0) {
                call.reject("empty");
                return;
            }
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                call.reject("unsupported");
                return;
            }
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            Uri tree = rootTree();
            if (tree != null) {
                String rel = folder.replaceFirst("(?i)^qalam/?", "");
                try {
                    Uri made = writeInto(tree, rel, name, mime, bytes);
                    JSObject done = new JSObject();
                    done.put("where", "root");
                    done.put("path", prefs().getString("path", "QALAM") + (rel.length() > 0 ? "/" + rel : ""));
                    done.put("uri", made.toString());
                    call.resolve(done);
                    return;
                } catch (Exception folderGone) {
                    // the chosen folder is no longer reachable: Downloads, as before
                }
            }
            ContentResolver resolver = getContext().getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
            values.put(MediaStore.MediaColumns.MIME_TYPE, mime);
            values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/" + folder);
            Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) {
                call.reject("insert_failed");
                return;
            }
            OutputStream out = resolver.openOutputStream(uri);
            if (out == null) {
                call.reject("stream_failed");
                return;
            }
            out.write(bytes);
            out.flush();
            out.close();
            JSObject done = new JSObject();
            done.put("where", "downloads");
            done.put("path", Environment.DIRECTORY_DOWNLOADS + "/" + folder);
            done.put("uri", uri.toString());
            call.resolve(done);
        } catch (Exception e) {
            call.reject("save_failed");
        }
    }

    /** opens a file the app has just saved (in QALAM or in Downloads) with the app the phone uses for its kind: a PDF reader, Word… */
    @PluginMethod
    public void openUri(PluginCall call) {
        try {
            Uri u = Uri.parse(call.getString("uri", ""));
            String mime = call.getString("mime", "*/*");
            Intent view = new Intent(Intent.ACTION_VIEW);
            view.setDataAndType(u, mime);
            view.setClipData(ClipData.newRawUri("", u));
            view.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(view);
            call.resolve();
        } catch (android.content.ActivityNotFoundException none) {
            call.reject("no_app");
        } catch (Exception e) {
            call.reject("open_failed");
        }
    }

    // ---------- the QALAM folder: chosen once by the lawyer anywhere in the phone's storage, kept with a lasting permission;
    // the app makes its sub-folders (الموكلين/<client>, the backups…) and reads back what is put there by other means ----------
    private static final String PREFS = "qalam_folder";
    private static final String ID = DocumentsContract.Document.COLUMN_DOCUMENT_ID;
    private static final String NAME = DocumentsContract.Document.COLUMN_DISPLAY_NAME;
    private static final String MIME = DocumentsContract.Document.COLUMN_MIME_TYPE;
    private static final String DIR = DocumentsContract.Document.MIME_TYPE_DIR;

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, 0);
    }

    private String rootDoc() {
        return prefs().getString("doc", null);
    }

    /** the chosen folder, while the permission still holds and the folder still exists */
    private Uri rootTree() {
        String s = prefs().getString("tree", null);
        String doc = rootDoc();
        if (s == null || doc == null) return null;
        Uri u = Uri.parse(s);
        boolean held = false;
        for (UriPermission p : getContext().getContentResolver().getPersistedUriPermissions()) {
            if (p.getUri().equals(u) && p.isReadPermission() && p.isWritePermission()) held = true;
        }
        if (!held) return null;
        Cursor c = null;
        try {
            c = getContext().getContentResolver().query(DocumentsContract.buildDocumentUriUsingTree(u, doc), new String[]{ID}, null, null, null);
            if (c == null || !c.moveToFirst()) return null;
        } catch (Exception e) {
            return null;
        } finally {
            if (c != null) c.close();
        }
        return u;
    }

    /** a child of a folder by its name: kind 1 a folder, 0 a file */
    private String childId(Uri tree, String parentDoc, String name, int kind) {
        Cursor c = null;
        try {
            c = getContext().getContentResolver().query(DocumentsContract.buildChildDocumentsUriUsingTree(tree, parentDoc), new String[]{ID, NAME, MIME}, null, null, null);
            while (c != null && c.moveToNext()) {
                if (!name.equals(c.getString(1))) continue;
                boolean dir = DIR.equals(c.getString(2));
                if ((kind == 1) == dir) return c.getString(0);
            }
        } catch (Exception e) {
            return null;
        } finally {
            if (c != null) c.close();
        }
        return null;
    }

    private String dirOf(Uri tree, String path, boolean create) throws Exception {
        String doc = rootDoc();
        if (doc == null) return null;
        if (path == null) return doc;
        for (String part : path.split("/")) {
            String p = part.trim();
            if (p.length() == 0) continue;
            String id = childId(tree, doc, p, 1);
            if (id == null) {
                if (!create) return null;
                Uri made = DocumentsContract.createDocument(getContext().getContentResolver(), DocumentsContract.buildDocumentUriUsingTree(tree, doc), DIR, p);
                if (made == null) return null;
                id = DocumentsContract.getDocumentId(made);
            }
            doc = id;
        }
        return doc;
    }

    /** writes a file in a sub-folder of QALAM, replacing a file of the same name */
    private Uri writeInto(Uri tree, String path, String name, String mime, byte[] bytes) throws Exception {
        String dir = dirOf(tree, path, true);
        if (dir == null) throw new Exception("dir");
        ContentResolver r = getContext().getContentResolver();
        String old = childId(tree, dir, name, 0);
        Uri target = old != null ? DocumentsContract.buildDocumentUriUsingTree(tree, old)
                : DocumentsContract.createDocument(r, DocumentsContract.buildDocumentUriUsingTree(tree, dir), mime, name);
        if (target == null) throw new Exception("create");
        OutputStream out = r.openOutputStream(target, "wt");
        if (out == null) throw new Exception("stream");
        out.write(bytes);
        out.flush();
        out.close();
        return target;
    }

    private static String readable(String treeDocId) {
        int i = treeDocId.indexOf(':');
        return i >= 0 ? treeDocId.substring(i + 1) : treeDocId;
    }

    @PluginMethod
    public void rootStatus(PluginCall call) {
        JSObject r = new JSObject();
        boolean ok = rootTree() != null;
        r.put("ok", ok);
        r.put("path", ok ? prefs().getString("path", "QALAM") : "");
        call.resolve(r);
    }

    /** the system folder picker; a folder called QALAM is taken as it is, any other gets a QALAM folder inside it */
    @PluginMethod
    public void pickRoot(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            call.reject("unsupported");
            return;
        }
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        try {
            i.putExtra(DocumentsContract.EXTRA_INITIAL_URI, DocumentsContract.buildDocumentUri("com.android.externalstorage.documents", "primary:Documents"));
        } catch (Exception ignored) {
        }
        startActivityForResult(call, i, "pickRootResult");
    }

    @ActivityCallback
    private void pickRootResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        try {
            Intent data = result.getData();
            if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
                call.reject("cancelled");
                return;
            }
            Uri tree = data.getData();
            getContext().getContentResolver().takePersistableUriPermission(tree, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            String top = DocumentsContract.getTreeDocumentId(tree);
            String path = readable(top);
            int k = path.lastIndexOf('/');
            String name = k >= 0 ? path.substring(k + 1) : path;
            String doc = top;
            if (!"QALAM".equalsIgnoreCase(name)) {
                String id = childId(tree, top, "QALAM", 1);
                if (id == null) {
                    Uri made = DocumentsContract.createDocument(getContext().getContentResolver(), DocumentsContract.buildDocumentUriUsingTree(tree, top), DIR, "QALAM");
                    if (made == null) {
                        call.reject("create_failed");
                        return;
                    }
                    id = DocumentsContract.getDocumentId(made);
                }
                doc = id;
                path = (path.length() > 0 ? path + "/" : "") + "QALAM";
            }
            prefs().edit().putString("tree", tree.toString()).putString("doc", doc).putString("path", path).apply();
            JSObject r = new JSObject();
            r.put("ok", true);
            r.put("path", path);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("pick_failed");
        }
    }

    @PluginMethod
    public void writeTo(PluginCall call) {
        try {
            Uri tree = rootTree();
            if (tree == null) {
                call.reject("no_root");
                return;
            }
            byte[] bytes = Base64.decode(call.getString("data", ""), Base64.DEFAULT);
            Uri u = writeInto(tree, call.getString("path", ""), call.getString("name", "file.bin"), call.getString("mime", "application/octet-stream"), bytes);
            JSObject r = new JSObject();
            r.put("uri", u.toString());
            r.put("doc", DocumentsContract.getDocumentId(u));
            call.resolve(r);
        } catch (Exception e) {
            call.reject("write_failed");
        }
    }

    @PluginMethod
    public void listIn(PluginCall call) {
        try {
            Uri tree = rootTree();
            if (tree == null) {
                call.reject("no_root");
                return;
            }
            JSArray files = new JSArray();
            String dir = dirOf(tree, call.getString("path", ""), false);
            if (dir != null) {
                Cursor c = null;
                try {
                    c = getContext().getContentResolver().query(DocumentsContract.buildChildDocumentsUriUsingTree(tree, dir),
                            new String[]{ID, NAME, MIME, DocumentsContract.Document.COLUMN_SIZE, DocumentsContract.Document.COLUMN_LAST_MODIFIED}, null, null, null);
                    while (c != null && c.moveToNext()) {
                        boolean isDir = DIR.equals(c.getString(2));
                        if (isDir && !Boolean.TRUE.equals(call.getBoolean("dirs", false))) continue;
                        JSObject f = new JSObject();
                        if (isDir) f.put("dir", true);
                        f.put("name", c.getString(1));
                        f.put("mime", c.getString(2));
                        f.put("size", c.isNull(3) ? 0 : c.getLong(3));
                        f.put("at", c.isNull(4) ? 0 : c.getLong(4));
                        files.put(f);
                    }
                } finally {
                    if (c != null) c.close();
                }
            }
            JSObject r = new JSObject();
            r.put("files", files);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("list_failed");
        }
    }

    @PluginMethod
    public void readFrom(PluginCall call) {
        try {
            Uri tree = rootTree();
            if (tree == null) {
                call.reject("no_root");
                return;
            }
            String dir = dirOf(tree, call.getString("path", ""), false);
            String id = dir == null ? null : childId(tree, dir, call.getString("name", ""), 0);
            if (id == null) {
                call.reject("not_found");
                return;
            }
            InputStream in = getContext().getContentResolver().openInputStream(DocumentsContract.buildDocumentUriUsingTree(tree, id));
            if (in == null) {
                call.reject("read_failed");
                return;
            }
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] b = new byte[65536];
            int n;
            while ((n = in.read(b)) > 0) {
                buf.write(b, 0, n);
                if (buf.size() > 60 * 1024 * 1024) {
                    in.close();
                    call.reject("too_large");
                    return;
                }
            }
            in.close();
            JSObject r = new JSObject();
            r.put("data", Base64.encodeToString(buf.toByteArray(), Base64.NO_WRAP));
            call.resolve(r);
        } catch (Exception e) {
            call.reject("read_failed");
        }
    }

    // ---------- documents picked from anywhere on the phone (the original can then be deleted where it was, if the lawyer wishes) ----------
    @PluginMethod
    public void pickFiles(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("*/*");
        i.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/pdf", "image/*", "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"});
        i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        startActivityForResult(call, i, "pickFilesResult");
    }

    @ActivityCallback
    private void pickFilesResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        try {
            Intent data = result.getData();
            JSArray files = new JSArray();
            if (result.getResultCode() == Activity.RESULT_OK && data != null) {
                java.util.List<Uri> uris = new java.util.ArrayList<>();
                ClipData clip = data.getClipData();
                if (clip != null) {
                    for (int k = 0; k < clip.getItemCount(); k++) uris.add(clip.getItemAt(k).getUri());
                } else if (data.getData() != null) {
                    uris.add(data.getData());
                }
                ContentResolver r = getContext().getContentResolver();
                for (Uri u : uris) {
                    JSObject f = new JSObject();
                    String name = "وثيقة";
                    long size = 0;
                    Cursor c = null;
                    try {
                        c = r.query(u, new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE}, null, null, null);
                        if (c != null && c.moveToFirst()) {
                            if (!c.isNull(0)) name = c.getString(0);
                            if (!c.isNull(1)) size = c.getLong(1);
                        }
                    } catch (Exception ignored) {
                    } finally {
                        if (c != null) c.close();
                    }
                    boolean canDelete = false;
                    String doc = "";
                    try {
                        if (DocumentsContract.isDocumentUri(getContext(), u)) {
                            doc = DocumentsContract.getDocumentId(u);
                            Cursor fc = r.query(u, new String[]{DocumentsContract.Document.COLUMN_FLAGS}, null, null, null);
                            if (fc != null) {
                                if (fc.moveToFirst() && !fc.isNull(0)) canDelete = (fc.getInt(0) & DocumentsContract.Document.FLAG_SUPPORTS_DELETE) != 0;
                                fc.close();
                            }
                        }
                    } catch (Exception ignored) {
                    }
                    String mime = r.getType(u);
                    f.put("uri", u.toString());
                    f.put("name", name);
                    f.put("size", size);
                    f.put("mime", mime == null ? "application/octet-stream" : mime);
                    f.put("doc", doc);
                    f.put("canDelete", canDelete);
                    files.put(f);
                }
            }
            JSObject out = new JSObject();
            out.put("files", files);
            call.resolve(out);
        } catch (Exception e) {
            call.reject("pick_failed");
        }
    }

    /** deletes a file of the QALAM folder (path inside QALAM, and its name) */
    @PluginMethod
    public void deleteIn(PluginCall call) {
        boolean ok = false;
        try {
            Uri tree = rootTree();
            if (tree != null) {
                String dir = dirOf(tree, call.getString("path", ""), false);
                String id = dir == null ? null : childId(tree, dir, call.getString("name", ""), 0);
                if (id != null) ok = DocumentsContract.deleteDocument(getContext().getContentResolver(), DocumentsContract.buildDocumentUriUsingTree(tree, id));
            }
        } catch (Exception ignored) {
        }
        JSObject r = new JSObject();
        r.put("ok", ok);
        call.resolve(r);
    }

    /** makes a sub-folder of QALAM (and its parents) if it is not there yet */
    @PluginMethod
    public void ensureDir(PluginCall call) {
        boolean ok = false;
        try {
            Uri tree = rootTree();
            if (tree != null) ok = dirOf(tree, call.getString("path", ""), true) != null;
        } catch (Exception ignored) {
        }
        JSObject r = new JSObject();
        r.put("ok", ok);
        call.resolve(r);
    }

    @PluginMethod
    public void readUri(PluginCall call) {
        try {
            InputStream in = getContext().getContentResolver().openInputStream(Uri.parse(call.getString("uri", "")));
            if (in == null) {
                call.reject("read_failed");
                return;
            }
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] b = new byte[65536];
            int n;
            while ((n = in.read(b)) > 0) {
                buf.write(b, 0, n);
                if (buf.size() > 60 * 1024 * 1024) {
                    in.close();
                    call.reject("too_large");
                    return;
                }
            }
            in.close();
            JSObject r = new JSObject();
            r.put("data", Base64.encodeToString(buf.toByteArray(), Base64.NO_WRAP));
            call.resolve(r);
        } catch (Exception e) {
            call.reject("read_failed");
        }
    }

    @PluginMethod
    public void deleteUri(PluginCall call) {
        boolean ok = false;
        try {
            ok = DocumentsContract.deleteDocument(getContext().getContentResolver(), Uri.parse(call.getString("uri", "")));
        } catch (Exception ignored) {
        }
        JSObject r = new JSObject();
        r.put("ok", ok);
        call.resolve(r);
    }

    /** opens another app of the phone (the Mahakim app); when it is not installed, its page in the Play Store */
    /** which of the given apps are on the phone (the AI apps offered for a text) */
    @PluginMethod
    public void appsInstalled(PluginCall call) {
        JSObject out = new JSObject();
        try {
            JSArray list = call.getArray("packages");
            for (int i = 0; list != null && i < list.length(); i++) {
                String p = list.getString(i);
                boolean on = false;
                try {
                    on = getContext().getPackageManager().getLaunchIntentForPackage(p) != null;
                } catch (Exception ignored) {
                }
                out.put(p, on);
            }
        } catch (Exception ignored) {
        }
        JSObject r = new JSObject();
        r.put("installed", out);
        call.resolve(r);
    }

    /** a page opened in the phone's browser */
    @PluginMethod
    public void openUrl(PluginCall call) {
        try {
            Intent web = new Intent(Intent.ACTION_VIEW, Uri.parse(call.getString("url", "")));
            web.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(web);
            call.resolve();
        } catch (Exception e) {
            call.reject("open_failed");
        }
    }

    /** a light touch under the finger (save, delete, choose); no permission is needed for it */
    @PluginMethod
    public void haptic(PluginCall call) {
        final String kind = call.getString("kind", "tap");
        try {
            getActivity().runOnUiThread(() -> {
                try {
                    android.view.View v = getBridge().getWebView();
                    int c = android.view.HapticFeedbackConstants.KEYBOARD_TAP;
                    if ("ok".equals(kind) && Build.VERSION.SDK_INT >= 30) c = android.view.HapticFeedbackConstants.CONFIRM;
                    else if ("warn".equals(kind) && Build.VERSION.SDK_INT >= 30) c = android.view.HapticFeedbackConstants.REJECT;
                    else if ("long".equals(kind)) c = android.view.HapticFeedbackConstants.LONG_PRESS;
                    v.performHapticFeedback(c);
                } catch (Exception ignored) {
                }
            });
        } catch (Exception ignored) {
        }
        call.resolve();
    }

    /** dictation: the phone's speech recognition (the Google window), the words come back as text */
    @PluginMethod
    public void dictate(PluginCall call) {
        try {
            Intent i = new Intent(android.speech.RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            i.putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE_MODEL, android.speech.RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            String lang = call.getString("lang", "ar-MA");
            i.putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE, lang);
            i.putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, lang);
            i.putExtra(android.speech.RecognizerIntent.EXTRA_PROMPT, call.getString("prompt", "تكلموا"));
            startActivityForResult(call, i, "dictateResult");
        } catch (Exception e) {
            call.reject("no_speech");
        }
    }

    @ActivityCallback
    private void dictateResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        try {
            Intent data = result.getData();
            String text = "";
            if (result.getResultCode() == Activity.RESULT_OK && data != null) {
                java.util.ArrayList<String> l = data.getStringArrayListExtra(android.speech.RecognizerIntent.EXTRA_RESULTS);
                if (l != null && !l.isEmpty()) text = l.get(0);
            }
            JSObject r = new JSObject();
            r.put("text", text);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("speech_failed");
        }
    }

    @PluginMethod
    public void openApp(PluginCall call) {
        String pkg = call.getString("package", "");
        String fallback = call.getString("fallback", "");
        JSObject done = new JSObject();
        try {
            Intent launch = getContext().getPackageManager().getLaunchIntentForPackage(pkg);
            if (launch != null) {
                launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getActivity().startActivity(launch);
                done.put("opened", "app");
                call.resolve(done);
                return;
            }
        } catch (Exception ignored) {
        }
        try {
            Intent store = new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + pkg));
            store.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(store);
            done.put("opened", "store");
            call.resolve(done);
            return;
        } catch (Exception ignored) {
        }
        try {
            Intent web = new Intent(Intent.ACTION_VIEW, Uri.parse(fallback != null && fallback.length() > 0 ? fallback : "https://play.google.com/store/apps/details?id=" + pkg));
            web.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(web);
            done.put("opened", "web");
            call.resolve(done);
        } catch (Exception e) {
            call.reject("open_failed");
        }
    }

    /** prints a PDF made by the app (the table of the appointments…) with the printing of Android: the printers of the phone, or «Save as PDF» */
    @PluginMethod
    public void printPdf(final PluginCall call) {
        try {
            String data = call.getString("data", "");
            final String name = call.getString("name", "document.pdf");
            if (data == null || data.length() == 0) {
                call.reject("empty");
                return;
            }
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            final java.io.File file = new java.io.File(getContext().getCacheDir(), "print-" + System.currentTimeMillis() + ".pdf");
            java.io.FileOutputStream fo = new java.io.FileOutputStream(file);
            fo.write(bytes);
            fo.flush();
            fo.close();
            final String job = name.replaceAll("(?i)\\.pdf$", "");
            getActivity().runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        android.print.PrintManager pm = (android.print.PrintManager) getActivity().getSystemService(android.content.Context.PRINT_SERVICE);
                        android.print.PrintAttributes attrs = new android.print.PrintAttributes.Builder()
                                .setMediaSize(android.print.PrintAttributes.MediaSize.ISO_A4)
                                .build();
                        pm.print(job, new PdfPrintAdapter(file, name), attrs);
                        call.resolve();
                    } catch (Exception e) {
                        call.reject("print_failed");
                    }
                }
            });
        } catch (Exception e) {
            call.reject("print_failed");
        }
    }

    /** hands the PDF as it is to the printing of Android */
    private static class PdfPrintAdapter extends android.print.PrintDocumentAdapter {
        private final java.io.File file;
        private final String name;

        PdfPrintAdapter(java.io.File file, String name) {
            this.file = file;
            this.name = name;
        }

        @Override
        public void onLayout(android.print.PrintAttributes oldAttributes, android.print.PrintAttributes newAttributes, android.os.CancellationSignal cancellationSignal, LayoutResultCallback callback, android.os.Bundle extras) {
            if (cancellationSignal != null && cancellationSignal.isCanceled()) {
                callback.onLayoutCancelled();
                return;
            }
            android.print.PrintDocumentInfo info = new android.print.PrintDocumentInfo.Builder(name)
                    .setContentType(android.print.PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
                    .build();
            callback.onLayoutFinished(info, true);
        }

        @Override
        public void onWrite(android.print.PageRange[] pages, android.os.ParcelFileDescriptor destination, android.os.CancellationSignal cancellationSignal, WriteResultCallback callback) {
            InputStream in = null;
            OutputStream out = null;
            try {
                in = new java.io.FileInputStream(file);
                out = new java.io.FileOutputStream(destination.getFileDescriptor());
                byte[] buf = new byte[16384];
                int n;
                while ((n = in.read(buf)) > 0) {
                    if (cancellationSignal != null && cancellationSignal.isCanceled()) {
                        callback.onWriteCancelled();
                        return;
                    }
                    out.write(buf, 0, n);
                }
                callback.onWriteFinished(new android.print.PageRange[]{android.print.PageRange.ALL_PAGES});
            } catch (Exception e) {
                callback.onWriteFailed(e.toString());
            } finally {
                try { if (in != null) in.close(); } catch (Exception ignored) { }
                try { if (out != null) out.close(); } catch (Exception ignored) { }
            }
        }

        @Override
        public void onFinish() {
            try { file.delete(); } catch (Exception ignored) { }
        }
    }

    @PluginMethod
    public void shareText(PluginCall call) {
        try {
            String text = call.getString("text", "");
            String title = call.getString("title", "مشاركة");
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("text/plain");
            send.putExtra(Intent.EXTRA_TEXT, text);
            String pkg = call.getString("package", "");
            if (pkg != null && pkg.length() > 0) {
                try {
                    Intent direct = new Intent(Intent.ACTION_SEND);
                    direct.setType("text/plain");
                    direct.putExtra(Intent.EXTRA_TEXT, text);
                    direct.setPackage(pkg);
                    direct.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getActivity().startActivity(direct);
                    JSObject done = new JSObject();
                    done.put("app", true);
                    call.resolve(done);
                    return;
                } catch (Exception notInstalled) {
                    // the app is not on the phone: the usual chooser
                }
            }
            Intent chooser = Intent.createChooser(send, title);
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(chooser);
            call.resolve();
        } catch (Exception e) {
            call.reject("share_failed");
        }
    }
}
