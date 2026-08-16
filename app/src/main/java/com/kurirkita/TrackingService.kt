package com.KurirKita

import android.annotation.SuppressLint
import android.app.*
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.location.Location
import android.os.BatteryManager
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.KurirKita.model.CourierLocation
import com.google.android.gms.location.*
import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.firestore.FirebaseFirestore

class TrackingService : Service() {

    private val database = FirebaseDatabase.getInstance("https://ontrack-fccb8-default-rtdb.asia-southeast1.firebasedatabase.app").getReference("courier_live_location")
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    
    private var lastLocation: Location? = null
    private var totalDistanceKm: Double = 0.0
    private var trackingIntervalMs: Long = 10000L
    private var trackingMinDistance: Float = 10f // Default 10 meters

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        
        // Listen for remote settings
        FirebaseFirestore.getInstance().collection("config").document("tracking")
            .addSnapshotListener { snapshot, _ ->
                val newInterval = snapshot?.getLong("intervalMs")
                val newDistance = snapshot?.getDouble("minDistance")?.toFloat()
                
                var changed = false
                if (newInterval != null && newInterval != trackingIntervalMs) {
                    trackingIntervalMs = newInterval
                    changed = true
                }
                if (newDistance != null && newDistance != trackingMinDistance) {
                    trackingMinDistance = newDistance
                    changed = true
                }

                if (changed && FirebaseAuth.getInstance().currentUser != null) {
                    Log.d("TrackingService", "Config changed: $trackingIntervalMs ms, $trackingMinDistance m")
                    startLocationUpdates()
                    showConfigUpdateNotification()
                }
            }

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                locationResult.lastLocation?.let { location ->
                    updateTelemetry(location)
                }
            }
        }
    }

    private fun updateTelemetry(location: Location) {
        val courierId = FirebaseAuth.getInstance().currentUser?.uid ?: "anonymous"
        
        // Calculate Distance
        lastLocation?.let {
            val distance = it.distanceTo(location) // meters
            totalDistanceKm += (distance / 1000.0)
        }
        lastLocation = location

        // Get Battery Level
        val batteryStatus: Intent? = IntentFilter(Intent.ACTION_BATTERY_CHANGED).let { ifilter ->
            applicationContext.registerReceiver(null, ifilter)
        }
        val batteryLevel = batteryStatus?.let { intent ->
            val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
            val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
            (level * 100 / scale.toFloat()).toInt()
        } ?: 0

        val courierLocation = CourierLocation(
            courierId = courierId,
            lat = location.latitude,
            lng = location.longitude,
            batteryLevel = batteryLevel,
            lastUpdated = Timestamp.now(),
            totalDistanceKm = totalDistanceKm
        )

        database.child(courierId).setValue(courierLocation)
        Log.d("TrackingService", "Telemetry sent: $courierLocation")
    }

    @SuppressLint("MissingPermission")
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        createNotificationChannel()
        val notification = NotificationCompat.Builder(this, "tracking_channel")
            .setContentTitle("KurirKita Aktif")
            .setContentText("Sedang melacak lokasi perjalanan...")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .build()

        startForeground(1, notification)
        startLocationUpdates()
        
        return START_STICKY
    }

    @SuppressLint("MissingPermission")
    private fun startLocationUpdates() {
        fusedLocationClient.removeLocationUpdates(locationCallback)
        
        val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, trackingIntervalMs)
            .setMinUpdateIntervalMillis(trackingIntervalMs / 2)
            .setMinUpdateDistanceMeters(trackingMinDistance) // Filter by radius/distance
            .build()

        fusedLocationClient.requestLocationUpdates(locationRequest, locationCallback, null)
    }

    private fun showConfigUpdateNotification() {
        val intervalText = if (trackingIntervalMs >= 60000) "${trackingIntervalMs / 60000} Menit" else "${trackingIntervalMs / 1000} Detik"
        val distanceText = if (trackingMinDistance >= 1000) "${trackingMinDistance / 1000} KM" else "${trackingMinDistance.toInt()} Meter"
        
        val channelId = "config_force_loud_v5" // New channel ID to bypass system cached settings
        val manager = getSystemService(NotificationManager::class.java)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "SINKRONISASI ATURAN"
            val importance = NotificationManager.IMPORTANCE_HIGH
            val channel = NotificationChannel(channelId, name, importance).apply {
                description = "Notifikasi perubahan aturan pelacakan"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 1000, 500, 1000)
                setSound(android.provider.Settings.System.DEFAULT_NOTIFICATION_URI, 
                    android.media.AudioAttributes.Builder()
                        .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION)
                        .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build())
                setLockscreenVisibility(Notification.VISIBILITY_PUBLIC)
                setShowBadge(true)
            }
            manager.createNotificationChannel(channel)
        }

        val notification = NotificationCompat.Builder(this, channelId)
            .setContentTitle("KEBIJAKAN BARU DITERAPKAN")
            .setContentText("Kirim tiap $intervalText / $distanceText")
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setVibrate(longArrayOf(0, 1000, 500, 1000))
            .setSound(android.provider.Settings.System.DEFAULT_NOTIFICATION_URI)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setAutoCancel(true)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .build()

        manager.notify(System.currentTimeMillis().toInt(), notification)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "tracking_channel",
                "Courier Tracking",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        fusedLocationClient.removeLocationUpdates(locationCallback)
    }
}
