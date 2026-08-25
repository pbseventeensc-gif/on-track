package com.KurirKita.ui

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.os.Build
import android.location.Location
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.core.content.FileProvider
import java.io.File
import android.net.Uri
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
    var geofenceRadius by remember { mutableStateOf(50f) }

    LaunchedEffect(Unit) {
        db.collection("config").document("tracking").addSnapshotListener { snap, _ ->
            val radius = snap?.getDouble("geofenceRadius")?.toFloat()
            if (radius != null) geofenceRadius = radius
        }
    }

    DisposableEffect(trip.tripId) {
        val reg = db.collection("trips").document(trip.tripId).addSnapshotListener { s, _ ->
            s?.toObject(Trip::class.java)?.let { currentTrip = it }
        }
        onDispose { reg.remove() }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Detail Perjalanan", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Kembali") }
                },
                actions = {
                    IconButton(onClick = onChatClick) {
                        Icon(Icons.AutoMirrored.Filled.Chat, contentDescription = "Chat", tint = Color(0xFFF1C40F))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface)
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).padding(innerPadding).padding(horizontal = 16.dp)
        ) {
            Card(
                modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                shape = RoundedCornerShape(12.dp)
            ) {
                Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("STATUS SAAT INI", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f))
                        Text(currentTrip.status.replace("_", " ").uppercase(), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Black)
                    }
                    if (currentTrip.status == "assigned") {
                        Button(
                            onClick = { db.collection("trips").document(currentTrip.tripId).update("status", "accepted") },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF1C40F), contentColor = Color.Black),
                            shape = RoundedCornerShape(8.dp)
                        ) { Text("TERIMA", fontWeight = FontWeight.Bold) }
                    }
                }
            }

            Text("Titik Tujuan", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, modifier = Modifier.padding(bottom = 8.dp))

            LazyColumn(modifier = Modifier.fillMaxSize()) {
                items(currentTrip.destinations.sortedBy { it.stopIndex }) { dest ->
                    DestinationItem(dest, fusedLocationClient, geofenceRadius) { status, bmp ->
                        if (bmp != null) uploadPhotoAndUpdate(storage, db, currentTrip, dest, bmp, status)
                        else updateDestinationStatus(db, currentTrip, dest, status, null)
                    }
                }
                item { Spacer(modifier = Modifier.height(20.dp)) }
            }
        }
    }
}

@SuppressLint("MissingPermission")
private fun validateSecurityAndLocation(context: android.content.Context, client: com.google.android.gms.location.FusedLocationProviderClient, targetLat: Double, targetLng: Double, radius: Float, onValid: () -> Unit) {
    client.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, CancellationTokenSource().token).addOnSuccessListener { loc ->
        if (loc == null) { Toast.makeText(context, "GPS tidak aktif", Toast.LENGTH_SHORT).show(); return@addOnSuccessListener }
        val isMock = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) loc.isMock else @Suppress("DEPRECATION") loc.isFromMockProvider
        if (isMock) { Toast.makeText(context, "🚨 Fake GPS terdeteksi!", Toast.LENGTH_LONG).show(); return@addOnSuccessListener }
        val res = FloatArray(1); Location.distanceBetween(loc.latitude, loc.longitude, targetLat, targetLng, res)
        if (res[0] > radius) Toast.makeText(context, "Terlalu Jauh! Jarak: %.0f m (Maks %.0f m)".format(res[0], radius), Toast.LENGTH_LONG).show() else onValid()
    }
}

@Composable
fun DestinationItem(dest: Destination, client: com.google.android.gms.location.FusedLocationProviderClient, radius: Float, onUpdate: (String, Bitmap?) -> Unit) {
    val context = androidx.compose.ui.platform.LocalContext.current
    var isUploading by remember { mutableStateOf(false) }
    var showPhoto by remember { mutableStateOf(false) }
    
    // Better photo quality implementation
    var photoUri by remember { mutableStateOf<Uri?>(null) }
    val cameraLauncher = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { success ->
        if (success && photoUri != null) {
            isUploading = true
            // Load high quality bitmap from URI
            try {
                val bitmap = android.graphics.BitmapFactory.decodeStream(context.contentResolver.openInputStream(photoUri!!))
                onUpdate("done", bitmap)
            } catch (e: Exception) {
                isUploading = false
                Toast.makeText(context, "Gagal memproses foto", Toast.LENGTH_SHORT).show()
            }
        }
    }

    fun launchCamera() {
        val file = File(context.cacheDir, "temp_proof_${System.currentTimeMillis()}.jpg")
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        photoUri = uri
        cameraLauncher.launch(uri)
    }

    if (showPhoto && dest.proofPhotoUrl.isNotEmpty()) {
        Dialog(onDismissRequest = { showPhoto = false }) {
            Card(modifier = Modifier.fillMaxWidth().height(450.dp), shape = RoundedCornerShape(16.dp)) {
                Box(modifier = Modifier.fillMaxSize()) {
                    Image(painter = rememberAsyncImagePainter(dest.proofPhotoUrl), contentDescription = null, modifier = Modifier.fillMaxSize(), contentScale = androidx.compose.ui.layout.ContentScale.Crop)
                    IconButton(onClick = { showPhoto = false }, modifier = Modifier.align(Alignment.TopEnd).padding(8.dp).background(Color.Black.copy(0.5f), CircleShape)) {
                        Icon(Icons.Default.Close, null, tint = Color.White)
                    }
                }
            }
        }
    }

    Card(
        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
        colors = CardDefaults.cardColors(containerColor = if (dest.status == "done") MaterialTheme.colorScheme.primaryContainer.copy(0.4f) else MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(shape = CircleShape, color = if (dest.status == "done") Color(0xFF43A047) else MaterialTheme.colorScheme.primary, modifier = Modifier.size(24.dp)) {
                    Box(contentAlignment = Alignment.Center) { Text(dest.stopIndex.toString(), color = Color.White, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold) }
                }
                Spacer(modifier = Modifier.width(12.dp))
                Text(text = dest.locationName, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.ExtraBold)
            }
            if (dest.address.isNotEmpty()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(text = dest.address, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant.copy(0.7f))
            }
            Spacer(modifier = Modifier.height(16.dp))
            if (dest.status == "done") {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.CheckCircle, null, tint = Color(0xFF43A047), modifier = Modifier.size(20.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Terkirim", color = Color(0xFF43A047), fontWeight = FontWeight.Bold)
                    if (dest.proofPhotoUrl.isNotEmpty()) {
                        Spacer(modifier = Modifier.width(12.dp))
                        TextButton(onClick = { showPhoto = true }) { Text("LIHAT FOTO", style = MaterialTheme.typography.labelSmall) }
                    }
                }
            } else {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    if (dest.status == "pending") Button(onClick = { validateSecurityAndLocation(context, client, dest.latitude, dest.longitude, radius) { onUpdate("arrived", null) } }, colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondaryContainer, contentColor = MaterialTheme.colorScheme.onSecondaryContainer)) { Text("SAYA TIBA") }
                    else if (dest.status == "arrived") {
                        Column(horizontalAlignment = Alignment.End) {
                            Button(onClick = { validateSecurityAndLocation(context, client, dest.latitude, dest.longitude, radius) { launchCamera() } }, enabled = !isUploading, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF1C40F), contentColor = Color.Black), shape = RoundedCornerShape(12.dp)) {
                                if (isUploading) CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.Black, strokeWidth = 2.dp)
                                else Text("FOTO & SELESAI", fontWeight = FontWeight.Black)
                            }
                            TextButton(onClick = { validateSecurityAndLocation(context, client, dest.latitude, dest.longitude, radius) { onUpdate("done", null) } }, enabled = !isUploading) { Text("Selesai Tanpa Foto", style = MaterialTheme.typography.labelSmall) }
                        }
                    }
                }
            }
        }
    }
}

private fun uploadPhotoAndUpdate(storage: FirebaseStorage, db: FirebaseFirestore, trip: Trip, dest: Destination, bitmap: Bitmap, status: String) {
    // Only scale if absolutely necessary, but keep high resolution
    val scaled = scaleBitmap(bitmap, 2500)
    val baos = ByteArrayOutputStream()
    // Use maximum JPEG quality (100) to prevent blurriness
    scaled.compress(Bitmap.CompressFormat.JPEG, 100, baos)
    try {
        MediaManager.get().upload(baos.toByteArray()).unsigned("KurirTrack").option("folder", "wellen_proofs").callback(object : UploadCallback {
            override fun onStart(id: String?) {}
            override fun onProgress(id: String?, b: Long, t: Long) {}
            override fun onSuccess(id: String?, res: Map<*, *>?) {
                val url = res?.get("secure_url") as? String
                if (url != null) updateDestinationStatus(db, trip, dest, status, url)
            }
            override fun onError(id: String?, e: ErrorInfo?) { uploadToFirebase(storage, db, trip, dest, scaled, status) }
            override fun onReschedule(id: String?, e: ErrorInfo?) {}
        }).dispatch()
    } catch (e: Exception) { uploadToFirebase(storage, db, trip, dest, scaled, status) }
}

private fun uploadToFirebase(storage: FirebaseStorage, db: FirebaseFirestore, trip: Trip, dest: Destination, bitmap: Bitmap, status: String) {
    val ref = storage.reference.child("proofs/${UUID.randomUUID()}.jpg")
    val baos = ByteArrayOutputStream()
    // Use 100% quality for Firebase as well
    bitmap.compress(Bitmap.CompressFormat.JPEG, 100, baos)
    ref.putBytes(baos.toByteArray()).addOnSuccessListener { ref.downloadUrl.addOnSuccessListener { uri -> updateDestinationStatus(db, trip, dest, status, uri.toString()) } }
}

private fun updateDestinationStatus(db: FirebaseFirestore, trip: Trip, dest: Destination, status: String, url: String?) {
    val updated = trip.destinations.map { if (it.stopIndex == dest.stopIndex) it.copy(status = status, arrivalTime = if (status == "arrived") Timestamp.now() else it.arrivalTime, completedTime = if (status == "done") Timestamp.now() else it.completedTime, proofPhotoUrl = url ?: it.proofPhotoUrl) else it }
    val map = mutableMapOf<String, Any>("destinations" to updated)
    if (trip.status == "accepted" && status == "arrived") map["status"] = "in_progress"
    if (updated.all { it.status == "done" }) map["status"] = "completed"
    db.collection("trips").document(trip.tripId).update(map)
}

private fun scaleBitmap(source: Bitmap, maxSize: Int): Bitmap {
    val w = source.width
    val h = source.height
    // Only downscale if original is larger than maxSize, don't upscale (which causes blur)
    if (w <= maxSize && h <= maxSize) return source
    
    var finalW = w
    var finalH = h
    val ratio = w.toFloat() / h.toFloat()
    if (ratio > 1) { finalW = maxSize; finalH = (maxSize / ratio).toInt() } else { finalH = maxSize; finalW = (maxSize * ratio).toInt() }
    return Bitmap.createScaledBitmap(source, finalW, finalH, true)
}
