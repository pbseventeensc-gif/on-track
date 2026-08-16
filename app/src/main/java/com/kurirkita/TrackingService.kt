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
    private var trackingIntervalMs: Long = 10000L // Default 10 seconds

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        
        // Listen for remote settings
        FirebaseFirestore.getInstance().collection("config").document("tracking")
            .addSnapshotListener { snapshot, _ ->
                val newInterval = snapshot?.getLong("intervalMs")
                if (newInterval != null && newInterval != trackingIntervalMs) {
                    trackingIntervalMs = newInterval
                    Log.d("TrackingService", "New interval: $trackingIntervalMs")
                    if (FirebaseAuth.getInstance().currentUser != null) {
                        startLocationUpdates() // Restart with new interval if already tracking
                    }
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
            .build()

        fusedLocationClient.requestLocationUpdates(locationRequest, locationCallback, null)
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
