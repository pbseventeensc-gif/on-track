package com.KurirKita.ui

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.util.Log
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
import com.cloudinary.android.MediaManager
import com.cloudinary.android.callback.ErrorInfo
import com.cloudinary.android.callback.UploadCallback
import java.io.ByteArrayOutputStream
import java.util.UUID

import android.location.Location
import android.widget.Toast
import com.google.android.gms.location.LocationServices

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ActiveTripScreen(trip: Trip, onBack: () -> Unit, onChatClick: () -> Unit) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val db = FirebaseFirestore.getInstance()
    var currentTrip by remember { mutableStateOf(trip) }
    val storage = FirebaseStorage.getInstance()
    val fusedLocationClient = remember { LocationServices.getFusedLocationProviderClient(context) }
    
    // ... existing Cloudinary init ...
    
    // Initialize Cloudinary if needed
    LaunchedEffect(Unit) {
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
                title = { Text("Detail Perjalanan", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) { 
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Kembali", tint = MaterialTheme.colorScheme.primary) 
                    }
                },
                actions = {
                    IconButton(onClick = onChatClick) {
                        Icon(Icons.AutoMirrored.Filled.Chat, contentDescription = "Chat", tint = Color(0xFFF1C40F))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.White, titleContentColor = Color.Black)
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
                .padding(innerPadding)
                .padding(horizontal = 16.dp)
        ) {
            Card(
                modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                shape = androidx.compose.foundation.shape.RoundedCornerShape(12.dp)
            ) {
                Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("STATUS SAAT INI", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f))
                        Text(currentTrip.status.replace("_", " ").uppercase(), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    if (currentTrip.status == "assigned") {
                        Button(
                            onClick = { db.collection("trips").document(currentTrip.tripId).update("status", "accepted") },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF1C40F), contentColor = Color.Black),
                            shape = androidx.compose.foundation.shape.RoundedCornerShape(8.dp)
                        ) {
                            Text("TERIMA", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            Text("Rute Tujuan", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onBackground, modifier = Modifier.padding(bottom = 8.dp))
            
            LazyColumn(modifier = Modifier.fillMaxSize()) {
                items(currentTrip.destinations.sortedBy { it.stopIndex }) { dest ->
                    DestinationItem(
                        dest = dest,
                        fusedLocationClient = fusedLocationClient,
                        onStatusUpdate = { newStatus, photoUri ->
                            if (photoUri != null) {
                                uploadPhotoAndUpdate(storage, db, currentTrip, dest, photoUri, newStatus)
                            } else {
                                updateDestinationStatus(db, currentTrip, dest, newStatus, null)
                            }
                        }
                    )
                }
                item { Spacer(modifier = Modifier.height(20.dp)) }
            }
        }
    }
}

@SuppressLint("MissingPermission")
private fun checkLocation(
    client: com.google.android.gms.location.FusedLocationProviderClient,
    targetLat: Double,
    targetLng: Double,
    onResult: (Boolean) -> Unit
) {
    client.lastLocation.addOnSuccessListener { location ->
        if (location != null) {
            val results = FloatArray(1)
            Location.distanceBetween(location.latitude, location.longitude, targetLat, targetLng, results)
            val distance = results[0]
            Log.d("LocationCheck", "Distance to ${targetLat},${targetLng}: $distance meters")
            
            // Threshold 150 meters
            onResult(distance <= 150f)
        } else {
            // No last location, maybe GPS off or not yet fixed
            onResult(false)
        }
    }.addOnFailureListener {
        onResult(false)
    }
}

@Composable
fun DestinationItem(
    dest: Destination, 
    fusedLocationClient: com.google.android.gms.location.FusedLocationProviderClient,
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
            // Final validation before upload
            checkLocation(fusedLocationClient, dest.latitude, dest.longitude) { isNear ->
                if (isNear) {
                    onStatusUpdate("done", bitmap)
                } else {
                    isUploading = false
                    Toast.makeText(context, "Gagal Selesai: Anda terlalu jauh dari lokasi!", Toast.LENGTH_LONG).show()
                }
            }
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
        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (dest.status == "done") MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.4f) else MaterialTheme.colorScheme.surface
        ),
        shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(
                    shape = androidx.compose.foundation.shape.CircleShape,
                    color = if (dest.status == "done") Color(0xFF43A047) else MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(24.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(dest.stopIndex.toString(), color = Color.White, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                    }
                }
                Spacer(modifier = Modifier.width(12.dp))
                Text(text = dest.locationName, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.onSurface)
            }
            
            if (dest.address.isNotEmpty()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(text = dest.address, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f))
            }

            Spacer(modifier = Modifier.height(16.dp))
            
            if (dest.status == "done") {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color(0xFF43A047), modifier = Modifier.size(20.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Terkirim", color = Color(0xFF43A047), fontWeight = FontWeight.Bold)
                    if (dest.proofPhotoUrl.isNotEmpty()) {
                        Spacer(modifier = Modifier.width(12.dp))
                        TextButton(onClick = { showPhotoDialog = true }) {
                            Icon(Icons.Default.Image, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Lihat Foto", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
            } else {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    if (dest.status == "pending") {
                        Button(
                            onClick = { 
                                checkLocation(fusedLocationClient, dest.latitude, dest.longitude) { isNear ->
                                    if (isNear) onStatusUpdate("arrived", null)
                                    else Toast.makeText(context, "Terlalu Jauh! Mendekatlah ke lokasi untuk absen tiba.", Toast.LENGTH_LONG).show()
                                }
                            }, 
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondaryContainer, contentColor = MaterialTheme.colorScheme.onSecondaryContainer)
                        ) {
                            Text("SAYA TIBA")
                        }
                    } else if (dest.status == "arrived") {
                        Column(horizontalAlignment = Alignment.End) {
                            Button(
                                onClick = { 
                                    checkLocation(fusedLocationClient, dest.latitude, dest.longitude) { isNear ->
                                        if (isNear) cameraLauncher.launch(null)
                                        else Toast.makeText(context, "Terlalu Jauh! Silakan mendekat ke titik tujuan untuk mengambil foto bukti.", Toast.LENGTH_LONG).show()
                                    }
                                },
                                enabled = !isUploading,
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF1C40F), contentColor = Color.Black),
                                shape = androidx.compose.foundation.shape.RoundedCornerShape(12.dp)
                            ) {
                                if (isUploading) {
                                    CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.Black, strokeWidth = 2.dp)
                                } else {
                                    Icon(Icons.Default.CameraAlt, contentDescription = null, modifier = Modifier.size(20.dp))
                                    Spacer(modifier = Modifier.width(10.dp))
                                    Text("FOTO & SELESAI", fontWeight = FontWeight.Black)
                                }
                            }
                            TextButton(
                                onClick = { 
                                    checkLocation(fusedLocationClient, dest.latitude, dest.longitude) { isNear ->
                                        if (isNear) {
                                            isUploading = true
                                            onStatusUpdate("done", null) 
                                        } else {
                                            Toast.makeText(context, "Terlalu Jauh! Mendekatlah ke lokasi untuk menyelesaikan tugas.", Toast.LENGTH_LONG).show()
                                        }
                                    }
                                },
                                enabled = !isUploading,
                                modifier = Modifier.padding(top = 4.dp)
                            ) {
                                Text("Selesai Tanpa Foto", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelSmall)
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun uploadPhotoAndUpdate(storage: FirebaseStorage, db: FirebaseFirestore, trip: Trip, dest: Destination, bitmap: Bitmap, newStatus: String) {
    val scaledBitmap = scaleBitmap(bitmap, 640)
    Log.d("Upload", "Starting upload for ${dest.locationName} with Direct Cloudinary")
    
    // DATA DITANAM LANGSUNG KE APLIKASI
    val cloudName = "dgf3shxpf"
    val preset = "KurirTrack"

    val baos = ByteArrayOutputStream()
    scaledBitmap.compress(Bitmap.CompressFormat.JPEG, 50, baos)
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
