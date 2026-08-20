package com.KurirKita

import android.Manifest
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.DeleteSweep
import androidx.compose.material.icons.filled.LightMode
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.ui.graphics.Color
import androidx.lifecycle.viewmodel.compose.viewModel
import com.KurirKita.R
import com.KurirKita.model.Trip
import com.KurirKita.model.User
import com.KurirKita.ui.*
import com.KurirKita.ui.theme.KurirKitaTheme
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.cloudinary.android.MediaManager

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // TANAM LANGSUNG CLOUDINARY KE APLIKASI
        try {
            val config = mapOf(
                "cloud_name" to "dgf3shxpf",
                "secure" to true
            )
            MediaManager.init(this, config)
        } catch (e: Exception) {
            // Sudah terinisialisasi
        }
        
        val currentUser = FirebaseAuth.getInstance().currentUser
        if (currentUser != null) {
            registerUserInFirestore(currentUser.uid, currentUser.email ?: "")
        }

        enableEdgeToEdge()
        setContent {
            var darkTheme by remember { mutableStateOf(false) }
            
            // --- FEATURE: REAL-TIME UPDATE CHECK ---
            var updateUrl by remember { mutableStateOf<String?>(null) }
            LaunchedEffect(Unit) {
                FirebaseFirestore.getInstance().collection("config").document("app_status")
                    .addSnapshotListener { snap, _ ->
                        val remoteVersion = snap?.getLong("versionCode") ?: 0L
                        val currentVersion = 1L // Sesuai build.gradle.kts
                        if (remoteVersion > currentVersion) {
                            updateUrl = snap?.getString("downloadUrl")
                        }
                    }
            }

            KurirKitaTheme(darkTheme = darkTheme) {
                if (updateUrl != null) {
                    AlertDialog(
                        onDismissRequest = {},
                        title = { Text("Update Tersedia!") },
                        text = { Text("Versi aplikasi terbaru sudah dirilis. Silakan unduh untuk fitur yang lebih stabil.") },
                        confirmButton = {
                            Button(onClick = {
                                val intent = Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(updateUrl))
                                startActivity(intent)
                            }) { Text("UNDUH SEKARANG") }
                        }
                    )
                }

                var isLoggedIn by remember { mutableStateOf(FirebaseAuth.getInstance().currentUser != null) }
                if (!isLoggedIn) {
                    LoginScreen(onLoginSuccess = { isLoggedIn = true })
                } else {
                    MainNavigation(
                        darkTheme = darkTheme,
                        onThemeToggle = { darkTheme = !darkTheme },
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
    var showHistory by remember { mutableStateOf(false) }
    val tripViewModel: TripViewModel = viewModel()

    if (showChatTripId != null) {
        ChatScreen(tripId = showChatTripId!!, onBack = { showChatTripId = null })
    } else if (selectedTrip == null) {
        Column(modifier = Modifier.fillMaxSize()) {
            ServiceControlBar(onStartService, onStopService, onLogout, darkTheme, onThemeToggle)
            TabRow(selectedTabIndex = if (showHistory) 1 else 0, containerColor = MaterialTheme.colorScheme.surface) {
                Tab(selected = !showHistory, onClick = { showHistory = false }) {
                    Text("Tugas Aktif", modifier = Modifier.padding(12.dp))
                }
                Tab(selected = showHistory, onClick = { showHistory = true }) {
                    Text("Riwayat", modifier = Modifier.padding(12.dp))
                }
            }
            if (!showHistory) {
                TripListScreen(viewModel = tripViewModel, onTripClick = { selectedTrip = it })
            } else {
                HistoryScreen(viewModel = tripViewModel, onTripClick = { selectedTrip = it })
            }
        }
    } else {
        ActiveTripScreen(trip = selectedTrip!!, onBack = { selectedTrip = null }, onChatClick = { showChatTripId = selectedTrip!!.tripId })
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
            Text("Riwayat Selesai", color = MaterialTheme.colorScheme.onBackground, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
            if (historyTrips.isNotEmpty()) {
                IconButton(onClick = { showConfirmDelete = true }) {
                    Icon(Icons.Default.DeleteSweep, contentDescription = "Hapus Semua", tint = MaterialTheme.colorScheme.error)
                }
            }
        }
        // ... rest same ...
        Spacer(modifier = Modifier.height(16.dp))
        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Color(0xFFF1C40F)) }
        } else if (historyTrips.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("Belum ada riwayat tugas.", color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)) }
        } else {
            LazyColumn(modifier = Modifier.fillMaxSize()) {
                items(historyTrips) { trip ->
                    TripCard(trip, onClick = { onTripClick(trip) })
                }
            }
        }
    }
}

@Composable
fun ServiceControlBar(onStart: () -> Unit, onStop: () -> Unit, onLogout: () -> Unit, darkTheme: Boolean, onThemeToggle: () -> Unit) {
    var isTracking by remember { mutableStateOf(false) }
    val permissions = mutableListOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) permissions.add(Manifest.permission.POST_NOTIFICATIONS)
    val launcher = rememberLauncherForActivityResult(contract = ActivityResultContracts.RequestMultiplePermissions()) { results -> if (results.values.all { it }) { isTracking = true; onStart() } }

    Surface(color = MaterialTheme.colorScheme.primary, contentColor = MaterialTheme.colorScheme.onPrimary, modifier = Modifier.fillMaxWidth(), shadowElevation = 8.dp) {
        Column {
            Row(modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 16.dp).statusBarsPadding(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Image(painter = painterResource(id = R.drawable.wellen_logo), contentDescription = null, modifier = Modifier.size(44.dp).padding(end = 12.dp))
                    Column {
                        val uid = FirebaseAuth.getInstance().currentUser?.uid ?: ""
                        Text(text = if (isTracking) "Live Tracking: ON" else "Tracking OFF", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Text(text = "UID: ${uid.take(8)}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.8f))
                    }
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = onThemeToggle) { Icon(imageVector = if (darkTheme) Icons.Default.LightMode else Icons.Default.DarkMode, contentDescription = "Theme", tint = Color.White) }
                    Switch(checked = isTracking, onCheckedChange = { checked -> if (checked) launcher.launch(permissions.toTypedArray()) else { isTracking = false; onStop() } }, colors = SwitchDefaults.colors(checkedThumbColor = Color(0xFFF1C40F), checkedTrackColor = Color(0xFFF1C40F).copy(alpha = 0.5f)))
                }
            }
            Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp), horizontalArrangement = Arrangement.End) {
                Text(text = "LOGOUT", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Black, modifier = Modifier.clickable { onLogout() })
            }
        }
    }
}
