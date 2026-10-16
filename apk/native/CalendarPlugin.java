package ma.qalam.app;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CalendarContract;
import android.provider.Settings;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.TimeZone;
import org.json.JSONObject;

@CapacitorPlugin(
    name = "CalendarInsert",
    permissions = {
        @Permission(strings = { Manifest.permission.READ_CALENDAR, Manifest.permission.WRITE_CALENDAR }, alias = "calendar")
    }
)
public class CalendarPlugin extends Plugin {

    private void open(PluginCall call, Intent intent) {
        try {
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("unavailable");
        }
    }

    @PluginMethod
    public void insert(PluginCall call) {
        try {
            Intent intent = new Intent(Intent.ACTION_INSERT);
            intent.setData(CalendarContract.Events.CONTENT_URI);
            intent.putExtra(CalendarContract.Events.TITLE, call.getString("title", ""));
            intent.putExtra(CalendarContract.Events.DESCRIPTION, call.getString("description", ""));
            intent.putExtra(CalendarContract.Events.EVENT_LOCATION, call.getString("location", ""));
            intent.putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, Long.parseLong(call.getString("start", "0")));
            intent.putExtra(CalendarContract.EXTRA_EVENT_END_TIME, Long.parseLong(call.getString("end", "0")));
            intent.putExtra(CalendarContract.EXTRA_EVENT_ALL_DAY, Boolean.TRUE.equals(call.getBoolean("allDay", false)));
            open(call, intent);
        } catch (Exception e) {
            call.reject("calendar_unavailable");
        }
    }

    /* Several appointments written straight into the phone's calendar in one go (with their reminders).
       An appointment added before is updated rather than added twice (its key is kept in the app's preferences). */
    @PluginMethod
    public void insertMany(PluginCall call) {
        if (getPermissionState("calendar") != PermissionState.GRANTED) {
            requestPermissionForAlias("calendar", call, "calendarPermission");
            return;
        }
        writeMany(call);
    }

    @PermissionCallback
    private void calendarPermission(PluginCall call) {
        if (getPermissionState("calendar") == PermissionState.GRANTED) writeMany(call);
        else call.reject("permission");
    }

    private long[] pickCalendar(ContentResolver cr, String[] name) {
        long best = -1;
        int bestScore = -1;
        Cursor c = null;
        try {
            c = cr.query(CalendarContract.Calendars.CONTENT_URI,
                new String[] { CalendarContract.Calendars._ID, CalendarContract.Calendars.IS_PRIMARY, CalendarContract.Calendars.VISIBLE,
                    CalendarContract.Calendars.ACCOUNT_TYPE, CalendarContract.Calendars.CALENDAR_DISPLAY_NAME },
                CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL + ">=" + CalendarContract.Calendars.CAL_ACCESS_CONTRIBUTOR, null, null);
            while (c != null && c.moveToNext()) {
                int score = 0;
                if (c.getInt(1) == 1) score += 4;
                if (c.getInt(2) == 1) score += 2;
                String type = c.getString(3);
                if (type != null && type.contains("google")) score += 1;
                if (score > bestScore) { bestScore = score; best = c.getLong(0); name[0] = c.getString(4); }
            }
        } catch (Exception e) {
            best = -1;
        } finally {
            if (c != null) try { c.close(); } catch (Exception ignored) {}
        }
        return new long[] { best };
    }

    private boolean alive(ContentResolver cr, long id) {
        Cursor c = null;
        try {
            c = cr.query(ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, id),
                new String[] { CalendarContract.Events._ID, CalendarContract.Events.DELETED }, null, null, null);
            return c != null && c.moveToFirst() && c.getInt(1) == 0;
        } catch (Exception e) {
            return false;
        } finally {
            if (c != null) try { c.close(); } catch (Exception ignored) {}
        }
    }

    private void writeMany(PluginCall call) {
        try {
            JSArray list = call.getArray("events");
            if (list == null || list.length() == 0) { call.reject("empty"); return; }
            ContentResolver cr = getContext().getContentResolver();
            String[] calName = new String[] { "" };
            long cal = pickCalendar(cr, calName)[0];
            if (cal < 0) { call.reject("no_calendar"); return; }
            SharedPreferences prefs = getContext().getSharedPreferences("zl_calendar", Context.MODE_PRIVATE);
            SharedPreferences.Editor ed = prefs.edit();
            int added = 0, updated = 0, failed = 0;
            for (int i = 0; i < list.length(); i++) {
                try {
                    JSONObject o = list.getJSONObject(i);
                    boolean allDay = o.optBoolean("allDay", false);
                    long start = Long.parseLong(o.optString("start", "0")), end = Long.parseLong(o.optString("end", "0"));
                    ContentValues v = new ContentValues();
                    v.put(CalendarContract.Events.TITLE, o.optString("title", ""));
                    v.put(CalendarContract.Events.DESCRIPTION, o.optString("description", ""));
                    v.put(CalendarContract.Events.EVENT_LOCATION, o.optString("location", ""));
                    v.put(CalendarContract.Events.DTSTART, start);
                    v.put(CalendarContract.Events.DTEND, end);
                    v.put(CalendarContract.Events.ALL_DAY, allDay ? 1 : 0);
                    v.put(CalendarContract.Events.EVENT_TIMEZONE, allDay ? "UTC" : TimeZone.getDefault().getID());
                    String key = o.optString("key", "");
                    long old = key.isEmpty() ? -1 : prefs.getLong(key, -1);
                    if (old > 0 && alive(cr, old)) {
                        cr.update(ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, old), v, null, null);
                        updated++;
                        continue;
                    }
                    v.put(CalendarContract.Events.CALENDAR_ID, cal);
                    Uri u = cr.insert(CalendarContract.Events.CONTENT_URI, v);
                    if (u == null) { failed++; continue; }
                    long id = ContentUris.parseId(u);
                    int[] mins = allDay ? new int[] { 360 } : new int[] { 1440, 60 };
                    for (int m : mins) {
                        ContentValues r = new ContentValues();
                        r.put(CalendarContract.Reminders.EVENT_ID, id);
                        r.put(CalendarContract.Reminders.MINUTES, m);
                        r.put(CalendarContract.Reminders.METHOD, CalendarContract.Reminders.METHOD_ALERT);
                        try { cr.insert(CalendarContract.Reminders.CONTENT_URI, r); } catch (Exception ignored) {}
                    }
                    if (!key.isEmpty()) ed.putLong(key, id);
                    added++;
                } catch (Exception e) {
                    failed++;
                }
            }
            ed.apply();
            JSObject res = new JSObject();
            res.put("added", added);
            res.put("updated", updated);
            res.put("failed", failed);
            res.put("calendar", calName[0] == null ? "" : calName[0]);
            call.resolve(res);
        } catch (Exception e) {
            call.reject("calendar_unavailable");
        }
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        open(call, new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.parse("package:" + getContext().getPackageName())));
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
        intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
        open(call, intent);
    }

    @PluginMethod
    public void askIgnoreBattery(PluginCall call) {
        open(call, new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                Uri.parse("package:" + getContext().getPackageName())));
    }
}
