package com.KurirKita.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForwardIos
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.LocalShipping
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.KurirKita.model.Trip
import com.google.firebase.firestore.FirebaseFirestore
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning

@Composable
fun TripListScreen(viewModel: TripViewModel, onTripClick: (Trip) -> Unit) {
    val trips by viewModel.trips.collectAsState()
    val isRefreshing by viewModel.isRefreshing.collectAsState()
    var showClaimDialog by remember { mutableStateOf(false) }
    var initialScanCode by remember { mutableStateOf("") }
    val context = androidx.compose.ui.platform.LocalContext.current

    val scannerOptions = remember {
        GmsBarcodeScannerOptions.Builder()
            .setBarcodeFormats(
                Barcode.FORMAT_QR_CODE,
                Barcode.FORMAT_CODE_128,
                Barcode.FORMAT_DATA_MATRIX
            )
            .enableAutoZoom()
            .build()
    }

    if (showClaimDialog) {
        ClaimTaskDialog(
            viewModel = viewModel, 
            initialCode = initialScanCode,
            onDismiss = { 
                showClaimDialog = false 
                initialScanCode = ""
            }
        )
    }

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(
                onClick = { 
                    initialScanCode = ""
                    showClaimDialog = true 
                },
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = Color.White
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(Icons.Default.QrCodeScanner, contentDescription = null)
                    Text("Scan / Input SJ", fontWeight = FontWeight.Bold)
                }
            }
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(MaterialTheme.colorScheme.background)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            "Daftar Tugas", 
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.ExtraBold,
                            color = MaterialTheme.colorScheme.onBackground,
                            letterSpacing = (-0.5).sp
                        )
                        val sdf = java.text.SimpleDateFormat("EEEE, dd MMM yyyy", java.util.Locale("id"))
                        Text(
                            text = sdf.format(java.util.Date()),
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                            fontWeight = FontWeight.Medium
                        )
                    }
                    
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        FilledTonalIconButton(
                            onClick = {
                                val scanner = GmsBarcodeScanning.getClient(context, scannerOptions)
                                scanner.startScan()
                                    .addOnSuccessListener { barcode ->
                                        val raw = barcode.rawValue ?: barcode.displayValue ?: ""
                                        if (raw.isNotBlank()) {
                                            initialScanCode = raw
                                            showClaimDialog = true
                                        }
                                    }
                                    .addOnFailureListener { e ->
                                        android.widget.Toast.makeText(context, "Scan error: ${e.message}", android.widget.Toast.LENGTH_SHORT).show()
                                    }
                            },
                            colors = IconButtonDefaults.filledTonalIconButtonColors(
                                containerColor = MaterialTheme.colorScheme.primaryContainer,
                                contentColor = MaterialTheme.colorScheme.primary
                            ),
                            modifier = Modifier.size(48.dp).shadow(2.dp, androidx.compose.foundation.shape.CircleShape)
                        ) {
                            Icon(Icons.Default.QrCodeScanner, contentDescription = "Scan QR Surat Jalan")
                        }

                        IconButton(
                            onClick = { viewModel.refresh() },
                            colors = IconButtonDefaults.iconButtonColors(
                                containerColor = MaterialTheme.colorScheme.surface,
                                contentColor = MaterialTheme.colorScheme.primary
                            ),
                            modifier = Modifier.size(48.dp).shadow(2.dp, androidx.compose.foundation.shape.CircleShape)
                        ) {
                            if (isRefreshing) {
                                CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 3.dp)
                            } else {
                                Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                            }
                        }
                    }
                }
            }
            
            if (trips.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Default.LocalShipping, 
                            contentDescription = null, 
                            modifier = Modifier.size(80.dp), 
                            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.2f)
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            "Belum ada rute aktif.", 
                            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f), 
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            "Scan QR Surat Jalan atau ketik kode unik untuk mengambil tugas pengiriman.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(trips) { trip ->
                        TripCard(trip, onTripClick)
                    }
                    item { Spacer(modifier = Modifier.height(24.dp)) }
                }
            }
        }
    }
}

@Composable
fun ClaimTaskDialog(
    viewModel: TripViewModel,
    initialCode: String = "",
    onDismiss: () -> Unit
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    var selectedTab by remember { mutableIntStateOf(0) } // 0 = Scan & Kode Unik, 1 = Master Toko

    // Tab 0 states (Scan & Kode Unik)
    var sjCodeInput by remember { mutableStateOf(initialCode) }
    var foundTrip by remember { mutableStateOf<Trip?>(null) }
    var searchError by remember { mutableStateOf("") }
    var isCheckingCode by remember { mutableStateOf(false) }

    val scannerOptions = remember {
        GmsBarcodeScannerOptions.Builder()
            .setBarcodeFormats(
                Barcode.FORMAT_QR_CODE,
                Barcode.FORMAT_CODE_128,
                Barcode.FORMAT_DATA_MATRIX
            )
            .enableAutoZoom()
            .build()
    }
    val scanner = remember { GmsBarcodeScanning.getClient(context, scannerOptions) }

    fun executeCodeSearch(codeToSearch: String) {
        if (codeToSearch.isNotBlank()) {
            isCheckingCode = true
            searchError = ""
            foundTrip = null
            viewModel.findTripByCode(codeToSearch) { trip, err ->
                isCheckingCode = false
                if (trip != null) {
                    foundTrip = trip
                } else {
                    searchError = err.ifEmpty { "Surat Jalan tidak ditemukan." }
                }
            }
        }
    }

    LaunchedEffect(initialCode) {
        if (initialCode.isNotBlank()) {
            executeCodeSearch(initialCode)
        }
    }

    // Tab 1 states (Master Toko)
    var searchQuery by remember { mutableStateOf("") }
    var searchResults by remember { mutableStateOf<List<Map<String, Any>>>(emptyList()) }
    var selectedStore by remember { mutableStateOf<Map<String, Any>?>(null) }
    var customStoreName by remember { mutableStateOf("") }
    var customAddress by remember { mutableStateOf("") }
    var isClaimingManual by remember { mutableStateOf(false) }

    LaunchedEffect(searchQuery, selectedTab) {
        if (selectedTab == 1) {
            viewModel.searchMasterClients(searchQuery) { results ->
                searchResults = results
            }
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Ambil Tugas Pengiriman", fontWeight = FontWeight.Bold)
                TabRow(
                    selectedTabIndex = selectedTab,
                    containerColor = Color.Transparent
                ) {
                    Tab(
                        selected = selectedTab == 0,
                        onClick = { selectedTab = 0 },
                        text = { Text("Scan / Kode SJ", fontSize = 12.sp, fontWeight = FontWeight.Bold) },
                        icon = { Icon(Icons.Default.QrCodeScanner, null, modifier = Modifier.size(16.dp)) }
                    )
                    Tab(
                        selected = selectedTab == 1,
                        onClick = { selectedTab = 1 },
                        text = { Text("Master Toko", fontSize = 12.sp, fontWeight = FontWeight.Bold) },
                        icon = { Icon(Icons.Default.Search, null, modifier = Modifier.size(16.dp)) }
                    )
                }
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 420.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                if (selectedTab == 0) {
                    // TAB 0: SCAN QR & KETIK KODE UNIK
                    Button(
                        onClick = {
                            scanner.startScan()
                                .addOnSuccessListener { barcode ->
                                    val raw = barcode.rawValue ?: barcode.displayValue ?: ""
                                    if (raw.isNotBlank()) {
                                        sjCodeInput = raw
                                        executeCodeSearch(raw)
                                    }
                                }
                                .addOnFailureListener { e ->
                                    searchError = "Gagal memindai: ${e.message}"
                                }
                        },
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                        shape = androidx.compose.foundation.shape.RoundedCornerShape(12.dp)
                    ) {
                        Icon(Icons.Default.CameraAlt, contentDescription = null, modifier = Modifier.size(20.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Buka Kamera Scan QR", fontWeight = FontWeight.Bold)
                    }

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp)
                    ) {
                        HorizontalDivider(modifier = Modifier.weight(1f))
                        Text("  ATAU KETIK KODE  ", fontSize = 10.sp, color = Color.Gray, fontWeight = FontWeight.Bold)
                        HorizontalDivider(modifier = Modifier.weight(1f))
                    }

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedTextField(
                            value = sjCodeInput,
                            onValueChange = { sjCodeInput = it; searchError = "" },
                            label = { Text("Kode Unik / No. SJ") },
                            placeholder = { Text("BY3BV / SJ-1126...") },
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                        Button(
                            onClick = { executeCodeSearch(sjCodeInput) },
                            enabled = sjCodeInput.isNotBlank() && !isCheckingCode,
                            modifier = Modifier.height(56.dp)
                        ) {
                            if (isCheckingCode) {
                                CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color.White, strokeWidth = 2.dp)
                            } else {
                                Text("Cari")
                            }
                        }
                    }

                    if (searchError.isNotEmpty()) {
                        Text(searchError, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                    }

                    if (foundTrip != null) {
                        Card(
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f)),
                            shape = androidx.compose.foundation.shape.RoundedCornerShape(14.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        Icons.Default.CheckCircle, 
                                        contentDescription = null, 
                                        tint = MaterialTheme.colorScheme.primary, 
                                        modifier = Modifier.size(18.dp)
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        "Surat Jalan Ditemukan", 
                                        fontWeight = FontWeight.Bold, 
                                        color = MaterialTheme.colorScheme.primary, 
                                        fontSize = 13.sp
                                    )
                                }
                                val dest = foundTrip!!.destinations.firstOrNull()
                                Text(
                                    text = dest?.locationName ?: foundTrip!!.customer.ifEmpty { "Customer" }, 
                                    fontWeight = FontWeight.Bold, 
                                    fontSize = 15.sp,
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                                Text(
                                    text = "No. SJ: ${foundTrip!!.sjNumber.ifEmpty { foundTrip!!.tripId }} (Kode: ${foundTrip!!.shortCode.ifEmpty { foundTrip!!.uniqueCode }})", 
                                    fontSize = 12.sp, 
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                if (!dest?.address.isNullOrEmpty()) {
                                    Text(
                                        text = "Alamat: ${dest!!.address}", 
                                        fontSize = 12.sp, 
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        maxLines = 2
                                    )
                                }
                                if (!dest?.itemsSummary.isNullOrEmpty()) {
                                    Text(
                                        text = "Barang: ${dest!!.itemsSummary} (${dest.qty})", 
                                        fontSize = 12.sp, 
                                        fontWeight = FontWeight.Medium,
                                        color = MaterialTheme.colorScheme.primary
                                    )
                                }
                            }
                        }
                    }
                } else {
                    // TAB 1: MASTER TOKO
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it },
                        label = { Text("Cari Toko dari Master Database") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )

                    if (selectedStore != null) {
                        Card(
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                Text("Terpilih: ${selectedStore!!["name"]}", fontWeight = FontWeight.Bold)
                                Text("${selectedStore!!["address"]}", style = MaterialTheme.typography.bodySmall)
                                TextButton(onClick = { selectedStore = null }) {
                                    Text("Ganti Pilihan")
                                }
                            }
                        }
                    } else {
                        if (searchResults.isEmpty() && searchQuery.isNotEmpty()) {
                            Text("Tidak ditemukan di master database. Masukkan manual di bawah:", style = MaterialTheme.typography.bodySmall, color = Color.Gray)
                            OutlinedTextField(
                                value = customStoreName,
                                onValueChange = { customStoreName = it },
                                label = { Text("Nama Toko / Klien") },
                                modifier = Modifier.fillMaxWidth()
                            )
                            OutlinedTextField(
                                value = customAddress,
                                onValueChange = { customAddress = it },
                                label = { Text("Alamat Lengkap") },
                                modifier = Modifier.fillMaxWidth()
                            )
                        } else {
                            LazyColumn(
                                modifier = Modifier.fillMaxWidth().height(200.dp),
                                verticalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                items(searchResults) { store ->
                                    Card(
                                        onClick = { selectedStore = store },
                                        modifier = Modifier.fillMaxWidth(),
                                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                                    ) {
                                        Column(modifier = Modifier.padding(8.dp)) {
                                            Text(store["name"] as? String ?: "", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                            Text(store["address"] as? String ?: "", fontSize = 12.sp, color = Color.Gray)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            if (selectedTab == 0) {
                Button(
                    onClick = {
                        if (foundTrip != null) {
                            isCheckingCode = true
                            viewModel.claimExistingTrip(foundTrip!!) { success, msg ->
                                isCheckingCode = false
                                android.widget.Toast.makeText(context, msg, android.widget.Toast.LENGTH_SHORT).show()
                                if (success) onDismiss()
                            }
                        } else {
                            executeCodeSearch(sjCodeInput)
                        }
                    },
                    enabled = (foundTrip != null || sjCodeInput.isNotBlank()) && !isCheckingCode
                ) {
                    if (isCheckingCode) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color.White)
                    } else if (foundTrip != null) {
                        Text("AMBIL TUGAS INI")
                    } else {
                        Text("Cek Kode")
                    }
                }
            } else {
                Button(
                    onClick = {
                        isClaimingManual = true
                        val storeName = selectedStore?.get("name") as? String ?: customStoreName
                        val address = selectedStore?.get("address") as? String ?: customAddress
                        val lat = selectedStore?.get("latitude") as? Double ?: -6.2088
                        val lng = selectedStore?.get("longitude") as? Double ?: 106.8456

                        if (storeName.isBlank() || address.isBlank()) {
                            android.widget.Toast.makeText(context, "Nama toko dan alamat harus diisi!", android.widget.Toast.LENGTH_SHORT).show()
                            isClaimingManual = false
                            return@Button
                        }

                        viewModel.claimOrCreateTrip(storeName, address, lat, lng) { success, msg ->
                            isClaimingManual = false
                            android.widget.Toast.makeText(context, msg, android.widget.Toast.LENGTH_SHORT).show()
                            if (success) onDismiss()
                        }
                    },
                    enabled = !isClaimingManual
                ) {
                    if (isClaimingManual) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color.White)
                    } else {
                        Text("Ambil Tugas")
                    }
                }
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Batal")
            }
        }
    )
}

@Composable
fun TripCard(trip: Trip, onClick: (Trip) -> Unit) {
    var unreadCount by remember { mutableIntStateOf(0) }
    
    DisposableEffect(trip.tripId) {
        val db = FirebaseFirestore.getInstance()
        val registration = db.collection("trips").document(trip.tripId)
            .collection("messages")
            .addSnapshotListener { snapshot, _ ->
                unreadCount = snapshot?.size() ?: 0
            }
        onDispose { registration.remove() }
    }

    Card(
        onClick = { onClick(trip) },
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color.LightGray.copy(alpha = 0.2f)),
        shape = androidx.compose.foundation.shape.RoundedCornerShape(24.dp)
    ) {
        Box {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    val firstDest = trip.destinations.firstOrNull()?.locationName ?: "Tujuan Baru"
                    Surface(
                        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.08f),
                        shape = androidx.compose.foundation.shape.RoundedCornerShape(14.dp),
                        modifier = Modifier.size(44.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                Icons.Default.LocalShipping, 
                                contentDescription = null, 
                                tint = MaterialTheme.colorScheme.primary, 
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = firstDest,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface,
                            maxLines = 1,
                            overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                        )
                        val sdf = remember { java.text.SimpleDateFormat("dd MMM yyyy", java.util.Locale("id")) }
                        val tripDateStr = try { sdf.format(trip.date.toDate()) } catch (_: Exception) { "" }
                        Text(
                            text = "${trip.destinations.size} Titik Pengantaran" + if (tripDateStr.isNotEmpty()) " • $tripDateStr" else "",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
                
                Spacer(modifier = Modifier.height(14.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    val statusColor = when(trip.status) {
                        "assigned" -> Color(0xFF8B5CF6)
                        "accepted" -> Color(0xFF3B82F6)
                        "in_progress" -> Color(0xFF3B82F6)
                        else -> Color(0xFF10B981)
                    }

                    val statusLabel = when(trip.status) {
                        "assigned" -> "TUGAS"
                        "accepted" -> "IN PROGRESS"
                        "in_progress" -> "IN PROGRESS"
                        else -> trip.status.uppercase()
                    }
                    
                    Surface(
                        color = statusColor.copy(alpha = 0.1f),
                        shape = androidx.compose.foundation.shape.CircleShape
                    ) {
                        Text(
                            text = statusLabel,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            color = statusColor,
                            letterSpacing = 0.5.sp
                        )
                    }
                    
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            "Lihat Detail", 
                            style = MaterialTheme.typography.labelMedium, 
                            color = MaterialTheme.colorScheme.primary, 
                            fontWeight = FontWeight.Bold
                        )
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowForwardIos, 
                            contentDescription = null, 
                            tint = MaterialTheme.colorScheme.primary, 
                            modifier = Modifier.size(10.dp).padding(start = 4.dp)
                        )
                    }
                }
            }
            
            if (unreadCount > 0) {
                Surface(
                    color = Color.Red,
                    shape = androidx.compose.foundation.shape.CircleShape,
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(12.dp)
                        .size(20.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(
                            text = unreadCount.toString(),
                            color = Color.White,
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}
