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
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
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
import androidx.compose.ui.graphics.asImageBitmap
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

@SuppressLint("MissingPermission")
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ActiveTripScreen(trip: Trip, onBack: () -> Unit, onChatClick: () -> Unit) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val db = FirebaseFirestore.getInstance()
    var currentTrip by remember { mutableStateOf(trip) }
    val storage = FirebaseStorage.getInstance()
    val fusedLocationClient = remember { LocationServices.getFusedLocationProviderClient(context) }
    var geofenceRadius by remember { mutableStateOf(200f) }

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
                            onClick = {
                                val map = mutableMapOf<String, Any>(
                                    "status" to "accepted",
                                    "acceptedTime" to Timestamp.now()
                                )
                                db.collection("trips").document(currentTrip.tripId).update(map)
                                    .addOnSuccessListener {
                                        Toast.makeText(context, "Tugas berhasil diterima!", Toast.LENGTH_SHORT).show()
                                    }

                                fusedLocationClient.lastLocation.addOnSuccessListener { loc ->
                                    if (loc != null) {
                                        db.collection("trips").document(currentTrip.tripId).update(
                                            "acceptLatitude", loc.latitude,
                                            "acceptLongitude", loc.longitude
                                        )
                                    } else {
                                        fusedLocationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, CancellationTokenSource().token)
                                            .addOnSuccessListener { loc2 ->
                                                if (loc2 != null) {
                                                    db.collection("trips").document(currentTrip.tripId).update(
                                                        "acceptLatitude", loc2.latitude,
                                                        "acceptLongitude", loc2.longitude
                                                    )
                                                }
                                            }
                                    }
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF1C40F), contentColor = Color.Black),
                            shape = RoundedCornerShape(8.dp)
                        ) { Text("TERIMA", fontWeight = FontWeight.Bold) }
                    }
                }
            }

            Text("Titik Tujuan", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, modifier = Modifier.padding(bottom = 8.dp))

            LazyColumn(modifier = Modifier.fillMaxSize()) {
                items(currentTrip.destinations.sortedBy { it.stopIndex }) { dest ->
                    DestinationItem(
                        dest = dest,
                        client = fusedLocationClient,
                        radius = geofenceRadius,
                        onUpdateStatus = { status ->
                            updateDestinationStatus(db, currentTrip, dest, status, null)
                        },
                        onUpdateWithCategorizedPhotos = { status, sjBmp, itemBmps ->
                            uploadCategorizedPhotosAndUpdate(storage, db, currentTrip, dest, sjBmp, itemBmps, status)
                        },
                        onUpdatePendingApproval = { reason, photoBmp ->
                            uploadPendingProofPhotoAndUpdate(storage, db, currentTrip, dest, reason, photoBmp)
                        }
                    )
                }
                item { Spacer(modifier = Modifier.height(20.dp)) }
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
    radius: Float,
    onValid: () -> Unit
) {
    if (targetLat == 0.0 && targetLng == 0.0) {
        onValid()
        return
    }

    client.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, CancellationTokenSource().token).addOnSuccessListener { loc ->
        if (loc == null) {
            client.lastLocation.addOnSuccessListener { lastLoc ->
                if (lastLoc != null) {
                    checkLocationAndExecute(context, lastLoc, targetLat, targetLng, radius, onValid)
                } else {
                    Toast.makeText(context, "GPS belum terdeteksi", Toast.LENGTH_SHORT).show()
                }
            }.addOnFailureListener {
                Toast.makeText(context, "Gagal membaca GPS", Toast.LENGTH_SHORT).show()
            }
            return@addOnSuccessListener
        }
        checkLocationAndExecute(context, loc, targetLat, targetLng, radius, onValid)
    }.addOnFailureListener {
        client.lastLocation.addOnSuccessListener { lastLoc ->
            if (lastLoc != null) {
                checkLocationAndExecute(context, lastLoc, targetLat, targetLng, radius, onValid)
            } else {
                Toast.makeText(context, "Gagal membaca GPS", Toast.LENGTH_SHORT).show()
            }
        }.addOnFailureListener {
            Toast.makeText(context, "Gagal membaca GPS", Toast.LENGTH_SHORT).show()
        }
    }
}

private fun checkLocationAndExecute(
    context: android.content.Context,
    loc: Location,
    targetLat: Double,
    targetLng: Double,
    radius: Float,
    onValid: () -> Unit
) {
    val isMock = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) loc.isMock else @Suppress("DEPRECATION") loc.isFromMockProvider
    if (isMock) {
        Toast.makeText(context, "🚨 Fake GPS terdeteksi!", Toast.LENGTH_LONG).show()
        return
    }
    if (targetLat == 0.0 && targetLng == 0.0) {
        onValid()
        return
    }
    val res = FloatArray(1)
    Location.distanceBetween(loc.latitude, loc.longitude, targetLat, targetLng, res)
    if (res[0] > radius) {
        Toast.makeText(context, "Terlalu Jauh dari Lokasi! Jarak: %.0f m (Maks %.0f m)".format(res[0], radius), Toast.LENGTH_LONG).show()
    } else {
        onValid()
    }
}

@Composable
fun DestinationItem(
    dest: Destination,
    client: com.google.android.gms.location.FusedLocationProviderClient,
    radius: Float,
    onUpdateStatus: (String) -> Unit,
    onUpdateWithCategorizedPhotos: (String, Bitmap?, List<Bitmap>) -> Unit,
    onUpdatePendingApproval: (String, Bitmap) -> Unit
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    var isUploading by remember { mutableStateOf(false) }
    var showPhotoDialog by remember { mutableStateOf(false) }

    // Categorized photos state
    var capturedSjBitmap by remember { mutableStateOf<Bitmap?>(null) }
    val capturedItemBitmaps = remember { mutableStateListOf<Bitmap>() }
    var activeCaptureMode by remember { mutableStateOf("sj") } // "sj" or "item"

    // Pending Approval Dialog state
    var showPendingDialog by remember { mutableStateOf(false) }
    var pendingReasonSelected by remember { mutableStateOf("Klien Tutup / Toko Belum Buka") }
    var customPendingReason by remember { mutableStateOf("") }
    var pendingPhotoBitmap by remember { mutableStateOf<Bitmap?>(null) }

    var photoUri by remember { mutableStateOf<Uri?>(null) }
    val cameraLauncher = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { success ->
        if (success && photoUri != null) {
            try {
                val bitmap = android.graphics.BitmapFactory.decodeStream(context.contentResolver.openInputStream(photoUri!!))
                if (bitmap != null) {
                    if (activeCaptureMode == "sj") {
                        capturedSjBitmap = bitmap
                    } else if (activeCaptureMode == "item") {
                        if (capturedItemBitmaps.size < 2) {
                            capturedItemBitmaps.add(bitmap)
                        } else {
                            Toast.makeText(context, "Maksimal 2 foto barang", Toast.LENGTH_SHORT).show()
                        }
                    } else if (activeCaptureMode == "pending") {
                        pendingPhotoBitmap = bitmap
                    }
                }
            } catch (e: Exception) {
                Toast.makeText(context, "Gagal memproses foto", Toast.LENGTH_SHORT).show()
            }
        }
    }

    fun launchCameraForSj() {
        activeCaptureMode = "sj"
        val file = File(context.cacheDir, "temp_proof_sj_${System.currentTimeMillis()}.jpg")
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        photoUri = uri
        cameraLauncher.launch(uri)
    }

    fun launchCameraForItem() {
        if (capturedItemBitmaps.size >= 2) {
            Toast.makeText(context, "Maksimal 2 foto barang sudah diambil", Toast.LENGTH_SHORT).show()
            return
        }
        activeCaptureMode = "item"
        val file = File(context.cacheDir, "temp_proof_item_${System.currentTimeMillis()}.jpg")
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        photoUri = uri
        cameraLauncher.launch(uri)
    }

    fun launchCameraForPending() {
        activeCaptureMode = "pending"
        val file = File(context.cacheDir, "temp_proof_pending_${System.currentTimeMillis()}.jpg")
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        photoUri = uri
        cameraLauncher.launch(uri)
    }

    // Pending Approval Request Dialog
    if (showPendingDialog) {
        Dialog(onDismissRequest = { showPendingDialog = false }) {
            Card(
                modifier = Modifier.fillMaxWidth().padding(8.dp),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("⚠️ Pending Shipment / Tunda", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        IconButton(onClick = { showPendingDialog = false }) {
                            Icon(Icons.Default.Close, contentDescription = "Tutup")
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Pilih Alasan:", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)

                    val reasons = listOf(
                        "Klien Tutup / Toko Belum Buka",
                        "Penerima Tidak Ada di Lokasi",
                        "Alamat Tidak Ditemukan / Salah",
                        "Lainnya"
                    )
                    reasons.forEach { r ->
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp)
                        ) {
                            RadioButton(
                                selected = (pendingReasonSelected == r),
                                onClick = { pendingReasonSelected = r }
                            )
                            Text(r, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(start = 4.dp))
                        }
                    }

                    if (pendingReasonSelected == "Lainnya") {
                        OutlinedTextField(
                            value = customPendingReason,
                            onValueChange = { customPendingReason = it },
                            label = { Text("Tuliskan Alasan") },
                            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Foto Bukti Pintu/Lokasi Tutup (Wajib):", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)

                    if (pendingPhotoBitmap != null) {
                        Card(
                            modifier = Modifier.fillMaxWidth().height(120.dp).padding(vertical = 6.dp),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Image(
                                bitmap = pendingPhotoBitmap!!.asImageBitmap(),
                                contentDescription = "Foto Pintu Tutup",
                                modifier = Modifier.fillMaxSize(),
                                contentScale = androidx.compose.ui.layout.ContentScale.Crop
                            )
                        }
                    }

                    OutlinedButton(
                        onClick = { launchCameraForPending() },
                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Icon(Icons.Default.CameraAlt, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(if (pendingPhotoBitmap == null) "AMBIL FOTO LOKASI TUTUP" else "FOTO ULANG")
                    }

                    Spacer(modifier = Modifier.height(12.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                        TextButton(onClick = { showPendingDialog = false }) { Text("Batal") }
                        Spacer(modifier = Modifier.width(8.dp))
                        Button(
                            onClick = {
                                val finalReason = if (pendingReasonSelected == "Lainnya") customPendingReason.ifEmpty { "Klien Tutup" } else pendingReasonSelected
                                if (pendingPhotoBitmap == null) {
                                    Toast.makeText(context, "Wajib mengambil 1 foto lokasi tutup", Toast.LENGTH_SHORT).show()
                                    return@Button
                                }
                                showPendingDialog = false
                                isUploading = true
                                onUpdatePendingApproval(finalReason, pendingPhotoBitmap!!)
                            },
                            enabled = pendingPhotoBitmap != null,
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE11D48), contentColor = Color.White),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text("KIRIM LAPORAN", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }

    if (showPhotoDialog && (dest.proofPhotoUrl.isNotEmpty() || dest.pendingProofPhotoUrl.isNotEmpty())) {
        Dialog(onDismissRequest = { showPhotoDialog = false }) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 550.dp),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            "Foto Bukti Pengantaran",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        IconButton(onClick = { showPhotoDialog = false }) {
                            Icon(Icons.Default.Close, contentDescription = "Tutup")
                        }
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    LazyColumn(
                        modifier = Modifier.fillMaxWidth().weight(1f, fill = false),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        // Pending Proof Photo
                        if (dest.pendingProofPhotoUrl.isNotEmpty()) {
                            item {
                                Text(
                                    "🚨 Foto Lokasi/Pintu Tutup",
                                    style = MaterialTheme.typography.labelMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFFE11D48),
                                    modifier = Modifier.padding(bottom = 4.dp)
                                )
                                Card(
                                    modifier = Modifier.fillMaxWidth().height(220.dp),
                                    shape = RoundedCornerShape(12.dp)
                                ) {
                                    Box(modifier = Modifier.fillMaxSize()) {
                                        Image(
                                            painter = rememberAsyncImagePainter(dest.pendingProofPhotoUrl),
                                            contentDescription = null,
                                            modifier = Modifier.fillMaxSize(),
                                            contentScale = androidx.compose.ui.layout.ContentScale.Crop
                                        )
                                        Surface(
                                            color = Color(0xFFE11D48),
                                            shape = RoundedCornerShape(topStart = 8.dp, bottomEnd = 8.dp),
                                            modifier = Modifier.align(Alignment.TopStart)
                                        ) {
                                            Text(
                                                "🚨 Klien Tutup",
                                                color = Color.White,
                                                style = MaterialTheme.typography.labelSmall,
                                                fontWeight = FontWeight.Bold,
                                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                            )
                                        }
                                    }
                                }
                            }
                        }

                        // 1. Show Surat Jalan Photo if present
                        if (dest.proofPhotoSj.isNotEmpty()) {
                            item {
                                Text(
                                    "📄 Surat Jalan (SJ)",
                                    style = MaterialTheme.typography.labelMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.padding(bottom = 4.dp)
                                )
                                Card(
                                    modifier = Modifier.fillMaxWidth().height(220.dp),
                                    shape = RoundedCornerShape(12.dp)
                                ) {
                                    Box(modifier = Modifier.fillMaxSize()) {
                                        Image(
                                            painter = rememberAsyncImagePainter(dest.proofPhotoSj),
                                            contentDescription = null,
                                            modifier = Modifier.fillMaxSize(),
                                            contentScale = androidx.compose.ui.layout.ContentScale.Crop
                                        )
                                        Surface(
                                            color = Color(0xFF1E40AF),
                                            shape = RoundedCornerShape(topStart = 8.dp, bottomEnd = 8.dp),
                                            modifier = Modifier.align(Alignment.TopStart)
                                        ) {
                                            Text(
                                                "📄 Surat Jalan",
                                                color = Color.White,
                                                style = MaterialTheme.typography.labelSmall,
                                                fontWeight = FontWeight.Bold,
                                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                            )
                                        }
                                    }
                                }
                            }
                        }

                        // 2. Show Item Photos if present
                        if (dest.proofPhotoItems.isNotEmpty()) {
                            item {
                                Text(
                                    "📦 Foto Barang (${dest.proofPhotoItems.size})",
                                    style = MaterialTheme.typography.labelMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF15803D),
                                    modifier = Modifier.padding(top = 8.dp, bottom = 4.dp)
                                )
                            }
                            itemsIndexed(dest.proofPhotoItems) { idx, url ->
                                Card(
                                    modifier = Modifier.fillMaxWidth().height(220.dp),
                                    shape = RoundedCornerShape(12.dp)
                                ) {
                                    Box(modifier = Modifier.fillMaxSize()) {
                                        Image(
                                            painter = rememberAsyncImagePainter(url),
                                            contentDescription = null,
                                            modifier = Modifier.fillMaxSize(),
                                            contentScale = androidx.compose.ui.layout.ContentScale.Crop
                                        )
                                        Surface(
                                            color = Color(0xFF15803D),
                                            shape = RoundedCornerShape(topStart = 8.dp, bottomEnd = 8.dp),
                                            modifier = Modifier.align(Alignment.TopStart)
                                        ) {
                                            Text(
                                                "📦 Barang #${idx + 1}",
                                                color = Color.White,
                                                style = MaterialTheme.typography.labelSmall,
                                                fontWeight = FontWeight.Bold,
                                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                            )
                                        }
                                    }
                                }
                            }
                        }

                        // Fallback for legacy single/comma-separated proofPhotoUrl
                        if (dest.proofPhotoSj.isEmpty() && dest.proofPhotoItems.isEmpty() && dest.pendingProofPhotoUrl.isEmpty() && dest.proofPhotoUrl.isNotEmpty()) {
                            val legacyUrls = dest.proofPhotoUrl.split(",").map { it.trim() }.filter { it.isNotEmpty() }
                            itemsIndexed(legacyUrls) { idx, url ->
                                Card(
                                    modifier = Modifier.fillMaxWidth().height(220.dp),
                                    shape = RoundedCornerShape(12.dp)
                                ) {
                                    Box(modifier = Modifier.fillMaxSize()) {
                                        Image(
                                            painter = rememberAsyncImagePainter(url),
                                            contentDescription = null,
                                            modifier = Modifier.fillMaxSize(),
                                            contentScale = androidx.compose.ui.layout.ContentScale.Crop
                                        )
                                        Surface(
                                            color = Color.Black.copy(0.6f),
                                            shape = RoundedCornerShape(topStart = 8.dp, bottomEnd = 8.dp),
                                            modifier = Modifier.align(Alignment.TopStart)
                                        ) {
                                            Text(
                                                "Foto #${idx + 1}",
                                                color = Color.White,
                                                style = MaterialTheme.typography.labelSmall,
                                                fontWeight = FontWeight.Bold,
                                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp)
            .then(
                if (dest.status == "pending" && dest.pendingReason.isNotEmpty()) {
                    Modifier.border(1.5.dp, Color(0xFFE11D48), RoundedCornerShape(16.dp))
                } else Modifier
            ),
        colors = CardDefaults.cardColors(
            containerColor = when (dest.status) {
                "done" -> MaterialTheme.colorScheme.primaryContainer.copy(0.4f)
                "pending_approval" -> Color(0xFFFFF7ED) // Orange-tint
                "pending" -> if (dest.pendingReason.isNotEmpty()) Color(0xFFFEF2F2) else MaterialTheme.colorScheme.surface // Red block if Klien Tutup
                else -> MaterialTheme.colorScheme.surface
            }
        ),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(
                    shape = CircleShape,
                    color = when (dest.status) {
                        "done" -> Color(0xFF43A047)
                        "pending_approval" -> Color(0xFFEA580C)
                        "pending" -> if (dest.pendingReason.isNotEmpty()) Color(0xFFE11D48) else MaterialTheme.colorScheme.primary
                        else -> MaterialTheme.colorScheme.primary
                    },
                    modifier = Modifier.size(24.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(
                            dest.stopIndex.toString(),
                            color = Color.White,
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
                Spacer(modifier = Modifier.width(12.dp))
                Text(
                    text = dest.locationName,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.ExtraBold
                )
            }
            if (dest.address.isNotEmpty()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = dest.address,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(0.7f)
                )
            }
            Spacer(modifier = Modifier.height(16.dp))
            if (dest.status == "done") {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Default.CheckCircle,
                        contentDescription = null,
                        tint = Color(0xFF43A047),
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Terkirim", color = Color(0xFF43A047), fontWeight = FontWeight.Bold)
                    if (dest.proofPhotoUrl.isNotEmpty() || dest.proofPhotoSj.isNotEmpty() || dest.proofPhotoItems.isNotEmpty()) {
                        val count = if (dest.proofPhotoSj.isNotEmpty() || dest.proofPhotoItems.isNotEmpty()) {
                            (if (dest.proofPhotoSj.isNotEmpty()) 1 else 0) + dest.proofPhotoItems.size
                        } else {
                            dest.proofPhotoUrl.split(",").map { it.trim() }.filter { it.isNotEmpty() }.size
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        TextButton(onClick = { showPhotoDialog = true }) {
                            Text("LIHAT FOTO ($count)", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            } else if (dest.status == "pending_approval") {
                // Pending Approval State
                Column(modifier = Modifier.fillMaxWidth()) {
                    Surface(
                        color = Color(0xFFEA580C).copy(alpha = 0.15f),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.HourglassTop, contentDescription = null, tint = Color(0xFFEA580C), modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("MENUNGGU APPROVAL ADMIN (KLIEN TUTUP)", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = Color(0xFFEA580C))
                            }
                            if (dest.pendingReason.isNotEmpty()) {
                                Text("Alasan: ${dest.pendingReason}", style = MaterialTheme.typography.bodySmall, color = Color.Black, modifier = Modifier.padding(top = 4.dp))
                            }
                        }
                    }
                }
            } else if (dest.status == "pending" && dest.pendingReason.isNotEmpty()) {
                // Approved Pending State (Klien Tutup Verified)
                Column(modifier = Modifier.fillMaxWidth()) {
                    Surface(
                        color = Color(0xFFE11D48).copy(alpha = 0.15f),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Cancel, contentDescription = null, tint = Color(0xFFE11D48), modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("PENDING - KLIEN TUTUP (APPROVED ADMIN)", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = Color(0xFFE11D48))
                            }
                            Text("Alasan: ${dest.pendingReason}", style = MaterialTheme.typography.bodySmall, color = Color.Black, modifier = Modifier.padding(top = 4.dp))
                        }
                    }
                }
            } else {
                if (dest.status == "pending") {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                        Button(
                            onClick = {
                                validateSecurityAndLocation(context, client, dest.latitude, dest.longitude, radius) {
                                    onUpdateStatus("arrived")
                                }
                            },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = MaterialTheme.colorScheme.secondaryContainer,
                                contentColor = MaterialTheme.colorScheme.onSecondaryContainer
                            )
                        ) {
                            Text("SAYA TIBA", fontWeight = FontWeight.Bold)
                        }
                    }
                } else if (dest.status == "arrived") {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = Alignment.Start
                    ) {
                        Text(
                            "Upload Bukti Pengantaran",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface,
                            modifier = Modifier.padding(bottom = 12.dp)
                        )

                        // SECTION 1: SURAT JALAN (SJ) PHOTO
                        Text(
                            "1. 📄 Foto Surat Jalan (SJ) — Maks 1 Foto",
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(bottom = 6.dp)
                        )

                        if (capturedSjBitmap != null) {
                            Card(
                                modifier = Modifier
                                    .size(100.dp)
                                    .padding(bottom = 8.dp),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Box(modifier = Modifier.fillMaxSize()) {
                                    Image(
                                        bitmap = capturedSjBitmap!!.asImageBitmap(),
                                        contentDescription = "Foto SJ",
                                        modifier = Modifier.fillMaxSize(),
                                        contentScale = androidx.compose.ui.layout.ContentScale.Crop
                                    )
                                    Surface(
                                        color = Color(0xFF1E40AF),
                                        shape = RoundedCornerShape(topStart = 8.dp, bottomEnd = 8.dp),
                                        modifier = Modifier.align(Alignment.TopStart)
                                    ) {
                                        Text(
                                            "📄 SJ",
                                            color = Color.White,
                                            style = MaterialTheme.typography.labelSmall,
                                            fontWeight = FontWeight.Bold,
                                            modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                                        )
                                    }
                                    IconButton(
                                        onClick = { capturedSjBitmap = null },
                                        enabled = !isUploading,
                                        modifier = Modifier
                                            .align(Alignment.TopEnd)
                                            .size(24.dp)
                                            .padding(2.dp)
                                            .background(Color.Black.copy(0.6f), CircleShape)
                                    ) {
                                        Icon(
                                            Icons.Default.Close,
                                            contentDescription = "Hapus foto SJ",
                                            tint = Color.White,
                                            modifier = Modifier.size(14.dp)
                                        )
                                    }
                                }
                            }
                        } else {
                            OutlinedButton(
                                onClick = {
                                    validateSecurityAndLocation(context, client, dest.latitude, dest.longitude, radius) {
                                        launchCameraForSj()
                                    }
                                },
                                enabled = !isUploading,
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.padding(bottom = 12.dp)
                            ) {
                                Icon(Icons.Default.CameraAlt, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("AMBIL FOTO SURAT JALAN (SJ)", fontWeight = FontWeight.Bold)
                            }
                        }

                        // SECTION 2: ITEM / BARANG PHOTOS
                        Text(
                            "2. 📦 Foto Fisik Barang — Maks 2 Foto",
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF15803D),
                            modifier = Modifier.padding(bottom = 6.dp)
                        )

                        if (capturedItemBitmaps.isNotEmpty()) {
                            LazyRow(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(bottom = 8.dp),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                itemsIndexed(capturedItemBitmaps) { index, bitmap ->
                                    Card(
                                        modifier = Modifier.size(100.dp),
                                        shape = RoundedCornerShape(12.dp)
                                    ) {
                                        Box(modifier = Modifier.fillMaxSize()) {
                                            Image(
                                                bitmap = bitmap.asImageBitmap(),
                                                contentDescription = "Foto Barang ${index + 1}",
                                                modifier = Modifier.fillMaxSize(),
                                                contentScale = androidx.compose.ui.layout.ContentScale.Crop
                                            )
                                            Surface(
                                                color = Color(0xFF15803D),
                                                shape = RoundedCornerShape(topStart = 8.dp, bottomEnd = 8.dp),
                                                modifier = Modifier.align(Alignment.TopStart)
                                            ) {
                                                Text(
                                                    "Barang #${index + 1}",
                                                    color = Color.White,
                                                    style = MaterialTheme.typography.labelSmall,
                                                    fontWeight = FontWeight.Bold,
                                                    modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                                                )
                                            }
                                            IconButton(
                                                onClick = { capturedItemBitmaps.removeAt(index) },
                                                enabled = !isUploading,
                                                modifier = Modifier
                                                    .align(Alignment.TopEnd)
                                                    .size(24.dp)
                                                    .padding(2.dp)
                                                    .background(Color.Black.copy(0.6f), CircleShape)
                                            ) {
                                                Icon(
                                                    Icons.Default.Close,
                                                    contentDescription = "Hapus foto barang",
                                                    tint = Color.White,
                                                    modifier = Modifier.size(14.dp)
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        if (capturedItemBitmaps.size < 2) {
                            OutlinedButton(
                                onClick = {
                                    validateSecurityAndLocation(context, client, dest.latitude, dest.longitude, radius) {
                                        launchCameraForItem()
                                    }
                                },
                                enabled = !isUploading,
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.padding(bottom = 16.dp)
                            ) {
                                Icon(Icons.Default.CameraAlt, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    if (capturedItemBitmaps.isEmpty()) "AMBIL FOTO BARANG (1/2)" else "AMBIL FOTO BARANG (2/2)",
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        } else {
                            Spacer(modifier = Modifier.height(12.dp))
                        }

                        // SUBMIT SECTION
                        val totalPhotos = (if (capturedSjBitmap != null) 1 else 0) + capturedItemBitmaps.size
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            OutlinedButton(
                                onClick = {
                                    validateSecurityAndLocation(context, client, dest.latitude, dest.longitude, radius) {
                                        showPendingDialog = true
                                    }
                                },
                                enabled = !isUploading,
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFE11D48)),
                                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE11D48)),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Icon(Icons.Default.Warning, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("PENDING SHIPMENT", fontWeight = FontWeight.Bold)
                            }

                            Button(
                                onClick = {
                                    validateSecurityAndLocation(context, client, dest.latitude, dest.longitude, radius) {
                                        isUploading = true
                                        onUpdateWithCategorizedPhotos("done", capturedSjBitmap, capturedItemBitmaps.toList())
                                    }
                                },
                                enabled = totalPhotos > 0 && !isUploading,
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF1C40F), contentColor = Color.Black),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                if (isUploading) {
                                    CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.Black, strokeWidth = 2.dp)
                                } else {
                                    Text("KIRIM ($totalPhotos FOTO)", fontWeight = FontWeight.Black)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun uploadPendingProofPhotoAndUpdate(
    storage: FirebaseStorage,
    db: FirebaseFirestore,
    trip: Trip,
    dest: Destination,
    reason: String,
    photoBitmap: Bitmap
) {
    Thread {
        val bytes = compressBitmapToBytes(photoBitmap, maxDimension = 1200, quality = 75)
        uploadSinglePhotoBytes(storage, bytes) { url ->
            val updated = trip.destinations.map {
                if (it.stopIndex == dest.stopIndex) {
                    it.copy(
                        status = "pending_approval",
                        pendingReason = reason,
                        pendingProofPhotoUrl = url ?: ""
                    )
                } else it
            }
            val map = mutableMapOf<String, Any>("destinations" to updated)
            db.collection("trips").document(trip.tripId).update(map)
        }
    }.start()
}

private fun compressBitmapToBytes(source: Bitmap, maxDimension: Int = 1200, quality: Int = 75): ByteArray {
    val w = source.width
    val h = source.height

    val scaled = if (w > maxDimension || h > maxDimension) {
        val ratio = w.toFloat() / h.toFloat()
        val (finalW, finalH) = if (ratio > 1) {
            maxDimension to (maxDimension / ratio).toInt()
        } else {
            (maxDimension * ratio).toInt() to maxDimension
        }
        Bitmap.createScaledBitmap(source, finalW, finalH, true)
    } else {
        source
    }

    val baos = ByteArrayOutputStream()
    scaled.compress(Bitmap.CompressFormat.JPEG, quality, baos)
    return baos.toByteArray()
}

private fun uploadCategorizedPhotosAndUpdate(
    storage: FirebaseStorage,
    db: FirebaseFirestore,
    trip: Trip,
    dest: Destination,
    sjBitmap: Bitmap?,
    itemBitmaps: List<Bitmap>,
    status: String
) {
    val totalToUpload = (if (sjBitmap != null) 1 else 0) + itemBitmaps.size
    if (totalToUpload == 0) {
        updateDestinationStatus(db, trip, dest, status, null)
        return
    }

    var sjUrl: String? = null
    val itemUrls = java.util.Collections.synchronizedList(mutableListOf<String?>())
    repeat(itemBitmaps.size) { itemUrls.add(null) }

    var finishedCount = 0

    fun checkAndFinish() {
        synchronized(itemUrls) {
            finishedCount++
            if (finishedCount == totalToUpload) {
                val validSjUrl = sjUrl ?: ""
                val validItemUrls = itemUrls.filterNotNull().filter { it.isNotEmpty() }

                val combinedList = mutableListOf<String>()
                if (validSjUrl.isNotEmpty()) combinedList.add(validSjUrl)
                combinedList.addAll(validItemUrls)
                val combinedUrl = if (combinedList.isNotEmpty()) combinedList.joinToString(",") else null

                updateDestinationStatus(db, trip, dest, status, combinedUrl, validSjUrl, validItemUrls)
            }
        }
    }

    // Compress & Upload SJ photo in background thread for ultra-fast performance
    if (sjBitmap != null) {
        Thread {
            val bytes = compressBitmapToBytes(sjBitmap, maxDimension = 1200, quality = 75)
            uploadSinglePhotoBytes(storage, bytes) { url ->
                sjUrl = url
                checkAndFinish()
            }
        }.start()
    }

    // Compress & Upload Item photos in background threads
    itemBitmaps.forEachIndexed { index, bitmap ->
        Thread {
            val bytes = compressBitmapToBytes(bitmap, maxDimension = 1200, quality = 75)
            uploadSinglePhotoBytes(storage, bytes) { url ->
                itemUrls[index] = url
                checkAndFinish()
            }
        }.start()
    }
}

private fun uploadSinglePhotoBytes(storage: FirebaseStorage, bytes: ByteArray, onComplete: (String?) -> Unit) {
    try {
        MediaManager.get().upload(bytes).unsigned("KurirTrack").option("folder", "wellen_proofs").callback(object : UploadCallback {
            override fun onStart(id: String?) {}
            override fun onProgress(id: String?, b: Long, t: Long) {}
            override fun onSuccess(id: String?, res: Map<*, *>?) {
                val url = res?.get("secure_url") as? String
                if (url != null) {
                    onComplete(url)
                } else {
                    uploadSingleToFirebase(storage, bytes, onComplete)
                }
            }
            override fun onError(id: String?, e: ErrorInfo?) {
                uploadSingleToFirebase(storage, bytes, onComplete)
            }
            override fun onReschedule(id: String?, e: ErrorInfo?) {}
        }).dispatch()
    } catch (e: Exception) {
        uploadSingleToFirebase(storage, bytes, onComplete)
    }
}

private fun uploadSingleToFirebase(storage: FirebaseStorage, bytes: ByteArray, onComplete: (String?) -> Unit) {
    val ref = storage.reference.child("proofs/${UUID.randomUUID()}.jpg")
    ref.putBytes(bytes).addOnSuccessListener {
        ref.downloadUrl.addOnSuccessListener { uri -> onComplete(uri.toString()) }
            .addOnFailureListener { onComplete(null) }
    }.addOnFailureListener { onComplete(null) }
}

private fun updateDestinationStatus(
    db: FirebaseFirestore,
    trip: Trip,
    dest: Destination,
    status: String,
    combinedUrl: String?,
    sjUrl: String? = null,
    itemUrls: List<String> = emptyList()
) {
    val updated = trip.destinations.map {
        if (it.stopIndex == dest.stopIndex) {
            it.copy(
                status = status,
                arrivalTime = if (status == "arrived") Timestamp.now() else it.arrivalTime,
                completedTime = if (status == "done") Timestamp.now() else it.completedTime,
                proofPhotoUrl = combinedUrl ?: it.proofPhotoUrl,
                proofPhotoSj = sjUrl ?: it.proofPhotoSj,
                proofPhotoItems = if (itemUrls.isNotEmpty()) itemUrls else it.proofPhotoItems
            )
        } else it
    }
    val map = mutableMapOf<String, Any>("destinations" to updated)
    if (status == "arrived" && trip.status != "completed") map["status"] = "in_progress"
    if (updated.all { it.status == "done" }) map["status"] = "completed"
    db.collection("trips").document(trip.tripId).update(map)
}
