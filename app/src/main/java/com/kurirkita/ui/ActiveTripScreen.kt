package com.KurirKita.ui

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.util.Log
import android.location.Location
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import coil.compose.rememberAsyncImagePainter
import com.KurirKita.model.Destination
import com.KurirKita.model.Trip
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.storage.FirebaseStorage
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import com.cloudinary.android.MediaManager
import com.cloudinary.android.callback.ErrorInfo
import com.cloudinary.android.callback.UploadCallback
import java.io.ByteArrayOutputStream
import java.util.UUID

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ActiveTripScreen(trip: Trip, onBack: () -> Unit, onChatClick: () -> Unit) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val db = FirebaseFirestore.getInstance()
    var currentTrip by remember { mutableStateOf(trip) }
    val storage = FirebaseStorage.getInstance()
    val fusedLocationClient = remember { LocationServices.getFusedLocationProviderClient(context) }
    var geofenceRadius by remember { mutableStateOf(50f) } // Default 50m
    
    // Listen for remote config
    LaunchedEffect(Unit) {
        db.collection("config").document("tracking").addSnapshotListener { snap, _ ->
            val radius = snap?.getDouble("geofenceRadius")?.toFloat()
            if (radius != null) geofenceRadius = radius
        }

        db.collection("config").document("cloudinary").get().addOnSuccessListener { doc ->
            val cloudName = doc.getString("cloudName")
            if (!cloudName.isNullOrEmpty()) {
                try {
                    val config = mapOf("cloud_name" to cloudName, "secure" to true)
                    MediaManager.init(context, config)
                } catch (e: Exception) {}
            }
        }
    }

    DisposableEffect(trip.tripId) {
        val registration = db.collection("trips").document(trip.tripId)
            .addSnapshotListener { snapshot, e ->
                if (e != null) return@addSnapshotListener
                snapshot?.toObject(Trip::class.java)?.let { currentTrip = it }
            }
        onDispose { registration.remove() }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { 
                    Column {
                        Text("Detail Rute", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Black)
                        Text(currentTrip.tripId.take(8).uppercase(), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) { 
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Kembali", tint = MaterialTheme.colorScheme.primary) 
                    }
                },
                actions = {
                    IconButton(
                        onClick = onChatClick,
                        modifier = Modifier.padding(end = 8.dp).background(MaterialTheme.colorScheme.primary.copy(alpha = 0.1f), androidx.compose.foundation.shape.CircleShape)
                    ) {
                        Icon(Icons.AutoMirrored.Filled.Chat, contentDescription = "Chat", tint = MaterialTheme.colorScheme.primary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface)
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
                .padding(innerPadding)
        ) {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = MaterialTheme.colorScheme.surface,
                shadowElevation = 2.dp
            ) {
                Row(
                    modifier = Modifier.padding(20.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column {
                        Text("STATUS PERJALANAN", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f))
                        Text(
                            text = currentTrip.status.replace("_", " ").uppercase(), 
                            style = MaterialTheme.typography.headlineSmall, 
                            fontWeight = FontWeight.Black, 
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                    if (currentTrip.status == "assigned") {
                        Button(
                            onClick = { db.collection("trips").document(currentTrip.tripId).update("status", "accepted") },
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                            shape = androidx.compose.foundation.shape.RoundedCornerShape(12.dp),
                            contentPadding = PaddingValues(horizontal = 24.dp, vertical = 12.dp)
                        ) {
                            Text("MULAI TUGAS", fontWeight = FontWeight.ExtraBold)
                        }
                    }
                }
            }

            Text(
                "TITIK TUJUAN", 
                style = MaterialTheme.typography.labelMedium, 
                fontWeight = FontWeight.Black, 
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f), 
                modifier = Modifier.padding(start = 20.dp, top = 24.dp, bottom = 8.dp)
            )
            
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(currentTrip.destinations.sortedBy { it.stopIndex }) { dest ->
                    DestinationItem(
                        dest = dest,
                        fusedLocationClient = fusedLocationClient,
                        geofenceRadius = geofenceRadius,
                        onStatusUpdate = { newStatus, photoUri ->
                            if (photoUri != null) {
                                uploadPhotoAndUpdate(storage, db, currentTrip, dest, photoUri, newStatus)
                            } else {
                                updateDestinationStatus(db, currentTrip, dest, newStatus, null)
                            }
                        }
                    )
                }
                item { Spacer(modifier = Modifier.height(40.dp)) }
            }
        }
    }
}

@SuppressLint("MissingPermission")
private fun validateSecurityAndLocation(
    context: android.content.Context,
    client: com.google.android.gms.location.FusedLocationProviderClient,
    targetLat: Double,
    targetLng: Double,
    radiusThreshold: Float,
    onValid: () -> Unit
) {
    val cts = CancellationTokenSource()
    client.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cts.token).addOnSuccessListener { location ->
        if (location == null) {
            Toast.makeText(context, "GPS tidak terdeteksi. Aktifkan GPS Anda.", Toast.LENGTH_SHORT).show()
            return@addOnSuccessListener
        }

        // 1. Detect Fake GPS (Mock Location)
        val isMock = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
            location.isMock
        } else {
            @Suppress("DEPRECATION")
            location.isFromMockProvider
        }

        if (isMock) {
            Toast.makeText(context, "🚨 PERINGATAN: Fake GPS Terdeteksi! Gunakan GPS asli atau akun Anda akan diblokir.", Toast.LENGTH_LONG).show()
            Log.e("Security", "Fake GPS Detected!")
            return@addOnSuccessListener
        }

        // 2. Geofencing (Configurable radius)
        val results = FloatArray(1)
        Location.distanceBetween(location.latitude, location.longitude, targetLat, targetLng, results)
        val distance = results[0]
        
        if (distance > radiusThreshold) {
            Toast.makeText(context, "Terlalu Jauh! Jarak Anda %.0f meter. Silakan mendekat ke lokasi (Maks %.0f m).".format(distance, radiusThreshold), Toast.LENGTH_LONG).show()
        } else {
            onValid()
        }
    }.addOnFailureListener {
        Toast.makeText(context, "Gagal memverifikasi lokasi GPS.", Toast.LENGTH_SHORT).show()
    }
}

@Composable
fun DestinationItem(
    dest: Destination, 
    fusedLocationClient: com.google.android.gms.location.FusedLocationProviderClient,
    geofenceRadius: Float,
    onStatusUpdate: (String, Bitmap?) -> Unit
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    var isUploading by remember { mutableStateOf(false) }
    var showPhotoDialog by remember { mutableStateOf(false) }

    val cameraLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicturePreview()
    ) { bitmap ->
        if (bitmap != null) {
            isUploading = true
            // Validation before finishing task with photo
            validateSecurityAndLocation(context, fusedLocationClient, dest.latitude, dest.longitude, geofenceRadius) {
                onStatusUpdate("done", bitmap)
            }
            if (dest.status != "done") isUploading = false
        }
    }

    LaunchedEffect(dest.status) {
        if (dest.status == "done") isUploading = false
    }

    if (showPhotoDialog && dest.proofPhotoUrl.isNotEmpty()) {
        Dialog(onDismissRequest = { showPhotoDialog = false }) {
            Card(
                modifier = Modifier.fillMaxWidth().height(450.dp),
                shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp)
            ) {
                Box(modifier = Modifier.fillMaxSize()) {
                    androidx.compose.foundation.Image(
                        painter = rememberAsyncImagePainter(dest.proofPhotoUrl),
                        contentDescription = "Bukti Foto",
                        modifier = Modifier.fillMaxSize(),
                        contentScale = androidx.compose.ui.layout.ContentScale.Crop
                    )
                    IconButton(
                        onClick = { showPhotoDialog = false },
                        modifier = Modifier.align(Alignment.TopEnd).padding(8.dp).background(Color.Black.copy(alpha = 0.5f), androidx.compose.foundation.shape.CircleShape)
                    ) {
                        Icon(Icons.Default.Close, contentDescription = "Close", tint = Color.White)
                    }
                }
            }
        }
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (dest.status == "done") MaterialTheme.colorScheme.primary.copy(alpha = 0.05f) else MaterialTheme.colorScheme.surface
        ),
        shape = androidx.compose.foundation.shape.RoundedCornerShape(20.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = if (dest.status == "done") 0.dp else 2.dp),
        border = if (dest.status == "done") androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.2f)) else null
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(
                    shape = androidx.compose.foundation.shape.CircleShape,
                    color = if (dest.status == "done") Color(0xFF27AE60) else MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(32.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(dest.stopIndex.toString(), color = Color.White, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Black)
                    }
                }
                Spacer(modifier = Modifier.width(16.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = dest.locationName, 
                        style = MaterialTheme.typography.titleMedium, 
                        fontWeight = FontWeight.ExtraBold, 
                        color = if (dest.status == "done") Color(0xFF27AE60) else MaterialTheme.colorScheme.onSurface
                    )
                    if (dest.address.isNotEmpty()) {
                        Text(
                            text = dest.address, 
                            style = MaterialTheme.typography.bodySmall, 
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))
            
            if (dest.status == "done") {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color(0xFF27AE60), modifier = Modifier.size(20.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Selesai", color = Color(0xFF27AE60), fontWeight = FontWeight.Black, style = MaterialTheme.typography.labelLarge)
                    }
                    if (dest.proofPhotoUrl.isNotEmpty()) {
                        Button(
                            onClick = { showPhotoDialog = true },
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.1f), contentColor = MaterialTheme.colorScheme.primary),
                            shape = androidx.compose.foundation.shape.RoundedCornerShape(10.dp),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                            modifier = Modifier.height(32.dp)
                        ) {
                            Icon(Icons.Default.Image, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("LIHAT FOTO", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            } else {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    if (dest.status == "pending") {
                        Button(
                            onClick = { 
                                validateSecurityAndLocation(context, fusedLocationClient, dest.latitude, dest.longitude, geofenceRadius) {
                                    onStatusUpdate("arrived", null)
                                }
                            }, 
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                            shape = androidx.compose.foundation.shape.RoundedCornerShape(12.dp)
                        ) {
                            Text("SAYA TIBA", fontWeight = FontWeight.Black)
                        }
                    } else if (dest.status == "arrived") {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            TextButton(
                                onClick = { 
                                    validateSecurityAndLocation(context, fusedLocationClient, dest.latitude, dest.longitude, geofenceRadius) {
                                        isUploading = true
                                        onStatusUpdate("done", null) 
                                    }
                                },
                                enabled = !isUploading
                            ) {
                                Text("Tanpa Foto", color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f), style = MaterialTheme.typography.labelLarge)
                            }
                            
                            Spacer(modifier = Modifier.width(8.dp))

                            Button(
                                onClick = { 
                                    validateSecurityAndLocation(context, fusedLocationClient, dest.latitude, dest.longitude, geofenceRadius) {
                                        cameraLauncher.launch(null)
                                    }
                                },
                                enabled = !isUploading,
                                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                                shape = androidx.compose.foundation.shape.RoundedCornerShape(12.dp)
                            ) {
                                if (isUploading) {
                                    CircularProgressIndicator(modifier = Modifier.size(18.dp), color = Color.White, strokeWidth = 2.dp)
                                } else {
                                    Icon(Icons.Default.CameraAlt, contentDescription = null, modifier = Modifier.size(18.dp))
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text("FOTO & SELESAI", fontWeight = FontWeight.Black)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun uploadPhotoAndUpdate(storage: FirebaseStorage, db: FirebaseFirestore, trip: Trip, dest: Destination, bitmap: Bitmap, newStatus: String) {
    val scaledBitmap = scaleBitmap(bitmap, 1280) // Increased resolution from 640
    Log.d("Upload", "Starting upload for ${dest.locationName} with High Res")
    
    // DATA DITANAM LANGSUNG KE APLIKASI
    val cloudName = "dgf3shxpf"
    val preset = "KurirTrack"

    val baos = ByteArrayOutputStream()
    scaledBitmap.compress(Bitmap.CompressFormat.JPEG, 80, baos) // Increased quality from 50
    val bytes = baos.toByteArray()
    
    try {
        MediaManager.get().upload(bytes)
            .unsigned(preset)
            .option("folder", "wellen_proofs")
            .callback(object : UploadCallback {
                override fun onStart(requestId: String?) {
                    Log.d("Upload", "Cloudinary Start")
                }
                override fun onProgress(requestId: String?, bytes: Long, totalBytes: Long) {}
                override fun onSuccess(requestId: String?, resultData: Map<*, *>?) {
                    val url = resultData?.get("secure_url") as? String
                    Log.d("Upload", "Cloudinary Success: $url")
                    if (url != null) updateDestinationStatus(db, trip, dest, newStatus, url)
                }
                override fun onError(requestId: String?, error: ErrorInfo?) {
                    Log.e("Upload", "Cloudinary Error: ${error?.description}")
                    uploadToFirebase(storage, db, trip, dest, scaledBitmap, newStatus)
                }
                override fun onReschedule(requestId: String?, error: ErrorInfo?) {}
            }).dispatch()
    } catch (e: Exception) {
        Log.e("Upload", "MediaManager Fatal Error: ${e.message}")
        uploadToFirebase(storage, db, trip, dest, scaledBitmap, newStatus)
    }
}

private fun uploadToFirebase(storage: FirebaseStorage, db: FirebaseFirestore, trip: Trip, dest: Destination, bitmap: Bitmap, newStatus: String) {
    val fileName = "proof_${trip.tripId}_${dest.stopIndex}_${UUID.randomUUID()}.jpg"
    val ref = storage.reference.child("proofs/$fileName")
    val baos = ByteArrayOutputStream()
    bitmap.compress(Bitmap.CompressFormat.JPEG, 50, baos)
    ref.putBytes(baos.toByteArray()).addOnSuccessListener {
        ref.downloadUrl.addOnSuccessListener { uri -> updateDestinationStatus(db, trip, dest, newStatus, uri.toString()) }
    }.addOnFailureListener { updateDestinationStatus(db, trip, dest, newStatus, null) }
}

private fun updateDestinationStatus(db: FirebaseFirestore, trip: Trip, dest: Destination, newStatus: String, photoUrl: String?) {
    val updatedDestinations = trip.destinations.map {
        if (it.stopIndex == dest.stopIndex) {
            val now = Timestamp.now()
            it.copy(status = newStatus, arrivalTime = if (newStatus == "arrived") now else it.arrivalTime, completedTime = if (newStatus == "done") now else it.completedTime, proofPhotoUrl = photoUrl ?: it.proofPhotoUrl)
        } else it
    }
    val updates = mutableMapOf<String, Any>("destinations" to updatedDestinations)
    if (trip.status == "accepted" && newStatus == "arrived") updates["status"] = "in_progress"
    if (updatedDestinations.all { it.status == "done" }) updates["status"] = "completed"
    db.collection("trips").document(trip.tripId).update(updates)
}

private fun scaleBitmap(source: Bitmap, maxSize: Int): Bitmap {
    var width = source.width
    var height = source.height
    val bitmapRatio = width.toFloat() / height.toFloat()
    if (bitmapRatio > 1) {
        width = maxSize
        height = (width / bitmapRatio).toInt()
    } else {
        height = maxSize
        width = (height * bitmapRatio).toInt()
    }
    return Bitmap.createScaledBitmap(source, width, height, true)
}
