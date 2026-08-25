package com.KurirKita

import android.Manifest
import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.DeleteSweep
import androidx.compose.material.icons.filled.GpsFixed
import androidx.compose.material.icons.filled.GpsOff
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.LightMode
import androidx.compose.material.icons.filled.LocalShipping
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import com.KurirKita.model.Trip
import com.KurirKita.model.User
import com.KurirKita.ui.*
import com.KurirKita.ui.theme.KurirKitaTheme
import com.KurirKita.ui.theme.GaugeGreen
import com.cloudinary.android.MediaManager
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import java.io.File

class MainActivity : ComponentActivity() {

    private val onDownloadComplete = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1)
            if (id != -1L) {
                installApk(context)
            }
        }
    }

    @SuppressLint("UnspecifiedRegisterReceiverFlag")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Register Download Receiver
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(onDownloadComplete, IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE), RECEIVER_EXPORTED)
        } else {
            registerReceiver(onDownloadComplete, IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE))
        }

        try {
            val config = mapOf("cloud_name" to "dgf3shxpf", "secure" to true)
            MediaManager.init(this, config)
        } catch (e: Exception) {}
        
        val currentUser = FirebaseAuth.getInstance().currentUser
        if (currentUser != null) registerUserInFirestore(currentUser.uid, currentUser.email ?: "")

        enableEdgeToEdge()
        val prefs = getSharedPreferences("app_settings", Context.MODE_PRIVATE)

        setContent {
            var darkTheme by remember { mutableStateOf(prefs.getBoolean("dark_mode", false)) }
            
            // Function to toggle theme and save it
            val toggleTheme = {
                darkTheme = !darkTheme
                prefs.edit().putBoolean("dark_mode", darkTheme).apply()
            }
            
            // --- FEATURE: IN-APP UPDATE (MATIKAN SEMENTARA AGAR TIDAK OVERWRITE DESAIN BARU) ---
            var updateUrl by remember { mutableStateOf<String?>(null) }
            var showUpdateDialog by remember { mutableStateOf(false) }
            
            /* 
            LaunchedEffect(Unit) {
                FirebaseFirestore.getInstance().collection("config").document("app_status")
                    .addSnapshotListener { snap, _ ->
                        val remoteVersion = snap?.getLong("versionCode") ?: 0L
                        // ... logic update ...
                    }
            }
            */

            KurirKitaTheme(darkTheme = darkTheme) {
                if (showUpdateDialog && updateUrl != null) {
                    AlertDialog(
                        onDismissRequest = { showUpdateDialog = false },
                        title = { Text("Update Tersedia!") },
                        text = { Text("Versi terbaru sudah dirilis. Silakan unduh untuk fitur yang lebih stabil.") },
                        confirmButton = {
                            Button(onClick = {
                                startDownload(updateUrl!!)
                                showUpdateDialog = false
                            }) { Text("UNDUH & INSTALL") }
                        },
                        dismissButton = {
                            TextButton(onClick = { showUpdateDialog = false }) {
                                Text("NANTI SAJA", color = Color.Gray)
                            }
                        }
                    )
                }

                var isLoggedIn by remember { mutableStateOf(FirebaseAuth.getInstance().currentUser != null) }
                if (!isLoggedIn) {
                    LoginScreen(onLoginSuccess = { isLoggedIn = true })
                } else {
                    MainNavigation(
                        darkTheme = darkTheme,
                        onThemeToggle = toggleTheme,
                        onLogout = {
                            FirebaseAuth.getInstance().signOut()
                            isLoggedIn = false
                            stopTrackingService()
                        },
                        onStartService = { startTrackingService() },
                        onStopService = { stopTrackingService() }
                    )
                }
            }
        }
    }

    private fun startDownload(url: String) {
        val request = DownloadManager.Request(Uri.parse(url))
            .setTitle("Wtrack Update")
            .setDescription("Mengunduh versi terbaru...")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "wtrack_update.apk")
            .setAllowedOverMetered(true)
            .setAllowedOverRoaming(true)

        val dm = getSystemService(DOWNLOAD_SERVICE) as DownloadManager
        dm.enqueue(request)
        Toast.makeText(this, "Unduhan dimulai...", Toast.LENGTH_SHORT).show()
    }

    private fun installApk(context: Context) {
        try {
            val file = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "wtrack_update.apk")
            if (file.exists()) {
                val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
                val intent = Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(uri, "application/vnd.android.package-archive")
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(intent)
            }
        } catch (e: Exception) {
            Toast.makeText(context, "Gagal menginstal: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }

    private fun startTrackingService() {
        val intent = Intent(this, TrackingService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(intent)
        else startService(intent)
    }

    private fun stopTrackingService() {
        val intent = Intent(this, TrackingService::class.java)
        stopService(intent)
    }

    private fun registerUserInFirestore(uid: String, email: String) {
        val user = User(userId = uid, name = email.split("@")[0], role = "courier")
        FirebaseFirestore.getInstance().collection("users").document(uid).set(user)
    }

    override fun onDestroy() {
        super.onDestroy()
        try { unregisterReceiver(onDownloadComplete) } catch (e: Exception) {}
    }
}

@Composable
fun MainNavigation(
    darkTheme: Boolean,
    onThemeToggle: () -> Unit,
    onLogout: () -> Unit,
    onStartService: () -> Unit,
    onStopService: () -> Unit
) {
    var selectedTrip by remember { mutableStateOf<Trip?>(null) }
    var showChatTripId by remember { mutableStateOf<String?>(null) }
    var currentTab by remember { mutableStateOf("dashboard") }
    val tripViewModel: TripViewModel = viewModel()

    Scaffold(
        topBar = {
            if (currentTab != "dashboard" && selectedTrip == null && showChatTripId == null) {
                ServiceControlBar(onStartService, onStopService, onLogout, darkTheme, onThemeToggle)
            }
        },
        bottomBar = {
            // Sembunyikan navigasi bawah jika sedang chat atau buka detail tugas agar tidak terhimpit
            if (selectedTrip == null && showChatTripId == null) {
                NavigationBar(
                    containerColor = MaterialTheme.colorScheme.surface,
                    tonalElevation = 8.dp
                ) {
                    NavigationBarItem(
                        selected = currentTab == "dashboard",
                        onClick = { currentTab = "dashboard"; selectedTrip = null },
                        icon = { Icon(Icons.Default.Dashboard, null) },
                        label = { Text("Dashboard", fontWeight = FontWeight.Bold) },
                        colors = NavigationBarItemDefaults.colors(selectedIconColor = MaterialTheme.colorScheme.primary, selectedTextColor = MaterialTheme.colorScheme.primary)
                    )
                    NavigationBarItem(
                        selected = currentTab == "active",
                        onClick = { currentTab = "active"; selectedTrip = null },
                        icon = { Icon(Icons.Default.LocalShipping, null) },
                        label = { Text("Tugas", fontWeight = FontWeight.Bold) },
                        colors = NavigationBarItemDefaults.colors(selectedIconColor = MaterialTheme.colorScheme.primary, selectedTextColor = MaterialTheme.colorScheme.primary)
                    )
                    NavigationBarItem(
                        selected = currentTab == "history",
                        onClick = { currentTab = "history"; selectedTrip = null },
                        icon = { Icon(Icons.Default.History, null) },
                        label = { Text("Riwayat", fontWeight = FontWeight.Bold) },
                        colors = NavigationBarItemDefaults.colors(selectedIconColor = MaterialTheme.colorScheme.primary, selectedTextColor = MaterialTheme.colorScheme.primary)
                    )
                }
            }
        }
    ) { innerPadding ->
        Box(modifier = Modifier.padding(if (selectedTrip == null && showChatTripId == null) innerPadding else PaddingValues(0.dp))) {
            if (showChatTripId != null) {
                ChatScreen(tripId = showChatTripId!!, onBack = { showChatTripId = null })
            } else if (selectedTrip == null) {
                when (currentTab) {
                    "dashboard" -> {
                        val dashboardState by tripViewModel.dashboardState.collectAsState()
                        DashboardScreen(
                            state = dashboardState,
                            onMenuClick = { /* Handle menu */ },
                            onCheckInClick = { onStartService() }
                        )
                    }
                    "active" -> TripListScreen(viewModel = tripViewModel, onTripClick = { selectedTrip = it })
                    "history" -> HistoryScreen(viewModel = tripViewModel, onTripClick = { selectedTrip = it })
                }
            } else {
                ActiveTripScreen(trip = selectedTrip!!, onBack = { selectedTrip = null }, onChatClick = { showChatTripId = selectedTrip!!.tripId })
            }
        }
    }
}

@Composable
fun HistoryScreen(viewModel: TripViewModel, onTripClick: (Trip) -> Unit) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val db = FirebaseFirestore.getInstance()
    val auth = FirebaseAuth.getInstance()
    var historyTrips by remember { mutableStateOf<List<Trip>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var showConfirmDelete by remember { mutableStateOf(false) }
    
    val prefs = remember { context.getSharedPreferences("app_prefs", android.content.Context.MODE_PRIVATE) }
    var lastClearedTime by remember { mutableStateOf(prefs.getLong("last_cleared_history", 0L)) }

    LaunchedEffect(lastClearedTime) {
        isLoading = true
        val uid = auth.currentUser?.uid ?: return@LaunchedEffect
        db.collection("trips").whereEqualTo("courierId", uid).whereEqualTo("status", "completed").get()
            .addOnSuccessListener { 
                val allTrips = it.toObjects(Trip::class.java)
                historyTrips = allTrips.filter { trip -> trip.date.seconds * 1000 > lastClearedTime }
                isLoading = false 
            }
            .addOnFailureListener { isLoading = false }
    }

    if (showConfirmDelete) {
        AlertDialog(
            onDismissRequest = { showConfirmDelete = false },
            title = { Text("Hapus Riwayat?") },
            text = { Text("Tugas yang sudah selesai akan disembunyikan dari HP ini. Data di pusat (Admin) tetap aman.") },
            confirmButton = {
                TextButton(onClick = {
                    val now = System.currentTimeMillis()
                    prefs.edit().putLong("last_cleared_history", now).apply()
                    lastClearedTime = now
                    showConfirmDelete = false
                }) { Text("YA, HAPUS", color = Color.Red) }
            },
            dismissButton = {
                TextButton(onClick = { showConfirmDelete = false }) { Text("BATAL") }
            }
        )
    }

    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).padding(16.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Column {
                Text(
                    "Riwayat Selesai", 
                    color = MaterialTheme.colorScheme.onBackground, 
                    style = MaterialTheme.typography.titleLarge, 
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = (-0.5).sp
                )
                Text(
                    "Daftar tugas yang telah Anda selesaikan",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                    fontWeight = FontWeight.Medium
                )
            }
            if (historyTrips.isNotEmpty()) {
                IconButton(
                    onClick = { showConfirmDelete = true },
                    colors = IconButtonDefaults.iconButtonColors(containerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.5f))
                ) {
                    Icon(Icons.Default.DeleteSweep, contentDescription = "Hapus Semua", tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(20.dp))
                }
            }
        }
        Spacer(modifier = Modifier.height(20.dp))
        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = GaugeGreen, strokeWidth = 3.dp) }
        } else if (historyTrips.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { 
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.History, null, modifier = Modifier.size(64.dp), tint = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.1f))
                    Spacer(modifier = Modifier.height(12.dp))
                    Text("Belum ada riwayat tugas.", color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f), style = MaterialTheme.typography.bodyMedium) 
                }
            }
        } else {
            LazyColumn(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                items(historyTrips) { trip ->
                    TripCard(trip, onClick = { onTripClick(trip) })
                }
                item { Spacer(modifier = Modifier.height(24.dp)) }
            }
        }
    }
}

@Composable
fun ServiceControlBar(onStart: () -> Unit, onStop: () -> Unit, onLogout: () -> Unit, darkTheme: Boolean, onThemeToggle: () -> Unit) {
    var isTracking by remember { mutableStateOf(false) }
    val permissions = mutableListOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) permissions.add(Manifest.permission.POST_NOTIFICATIONS)
    val launcher = rememberLauncherForActivityResult(contract = ActivityResultContracts.RequestMultiplePermissions()) { results -> 
        if (results.values.all { it }) { isTracking = true; onStart() } 
    }

    Surface(
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 2.dp,
        modifier = Modifier.fillMaxWidth().statusBarsPadding()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Image(
                        painter = painterResource(id = R.drawable.wellen_logo),
                        contentDescription = null,
                        modifier = Modifier.size(40.dp).padding(end = 12.dp)
                    )
                    Column {
                        Text(
                            text = "Wellen Print",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.ExtraBold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        val uid = FirebaseAuth.getInstance().currentUser?.uid ?: ""
                        Text(
                            text = "ID: ${uid.take(8).uppercase()}",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = onThemeToggle) {
                        Icon(
                            imageVector = if (darkTheme) Icons.Default.LightMode else Icons.Default.DarkMode,
                            contentDescription = "Theme",
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }
                    TextButton(onClick = onLogout) {
                        Text("Keluar", color = MaterialTheme.colorScheme.error, fontWeight = FontWeight.Bold)
                    }
                }
            }
            
            Spacer(modifier = Modifier.height(12.dp))
            
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = if (isTracking) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                ),
                shape = androidx.compose.foundation.shape.RoundedCornerShape(12.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = if (isTracking) Icons.Default.GpsFixed else Icons.Default.GpsOff,
                            contentDescription = null,
                            tint = if (isTracking) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = if (isTracking) "Tracking Aktif" else "Tracking Nonaktif",
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.Bold,
                            color = if (isTracking) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    Switch(
                        checked = isTracking,
                        onCheckedChange = { checked ->
                            if (checked) launcher.launch(permissions.toTypedArray())
                            else { isTracking = false; onStop() }
                        },
                        scale = 0.8f
                    )
                }
            }
        }
    }
}

// Helper to scale switch
@Composable
fun Switch(
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    scale: Float = 1f,
    enabled: Boolean = true
) {
    Box(modifier = Modifier.size((48 * scale).dp, (24 * scale).dp), contentAlignment = Alignment.Center) {
        androidx.compose.material3.Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            enabled = enabled,
            modifier = Modifier.padding(0.dp)
        )
    }
}
