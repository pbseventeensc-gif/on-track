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
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
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

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Ensure user is registered in Firestore if already logged in
        val currentUser = FirebaseAuth.getInstance().currentUser
        if (currentUser != null) {
            registerUserInFirestore(currentUser.uid, currentUser.email ?: "")
        }

        enableEdgeToEdge()
        setContent {
            KurirKitaTheme {
                var isLoggedIn by remember { mutableStateOf(FirebaseAuth.getInstance().currentUser != null) }

                if (!isLoggedIn) {
                    LoginScreen(onLoginSuccess = { isLoggedIn = true })
                } else {
                    MainNavigation(
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
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
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
    onLogout: () -> Unit,
    onStartService: () -> Unit,
    onStopService: () -> Unit
) {
    var selectedTrip by remember { mutableStateOf<Trip?>(null) }
    var showChatTripId by remember { mutableStateOf<String?>(null) }
    var showHistory by remember { mutableStateOf(false) }
    val tripViewModel: TripViewModel = viewModel()

    if (showChatTripId != null) {
        ChatScreen(
            tripId = showChatTripId!!,
            onBack = { showChatTripId = null }
        )
    } else if (selectedTrip == null) {
        Column(modifier = Modifier.fillMaxSize()) {
            ServiceControlBar(onStartService, onStopService, onLogout)
            
            // Tab Switcher for Active vs History
            TabRow(selectedTabIndex = if (showHistory) 1 else 0) {
                Tab(selected = !showHistory, onClick = { showHistory = false }) {
                    Text("Tugas Aktif", modifier = Modifier.padding(12.dp))
                }
                Tab(selected = showHistory, onClick = { showHistory = true }) {
                    Text("Riwayat", modifier = Modifier.padding(12.dp))
                }
            }

            if (!showHistory) {
                TripListScreen(
                    viewModel = tripViewModel,
                    onTripClick = { selectedTrip = it }
                )
            } else {
                HistoryScreen(
                    viewModel = tripViewModel,
                    onTripClick = { selectedTrip = it }
                )
            }
        }
    } else {
        ActiveTripScreen(
            trip = selectedTrip!!,
            onBack = { selectedTrip = null },
            onChatClick = { showChatTripId = selectedTrip!!.tripId }
        )
    }
}

@Composable
fun HistoryScreen(viewModel: TripViewModel, onTripClick: (Trip) -> Unit) {
    // In a real app, we might fetch a separate collection, but for now we filter locally
    val db = FirebaseFirestore.getInstance()
    val auth = FirebaseAuth.getInstance()
    var historyTrips by remember { mutableStateOf<List<Trip>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        val uid = auth.currentUser?.uid ?: return@LaunchedEffect
        db.collection("trips")
            .whereEqualTo("courierId", uid)
            .whereEqualTo("status", "completed")
            .get()
            .addOnSuccessListener { 
                historyTrips = it.toObjects(Trip::class.java)
                isLoading = false
            }
            .addOnFailureListener { isLoading = false }
    }

    Column(modifier = Modifier.fillMaxSize().background(Color(0xFFF8F9FA)).padding(16.dp)) {
        Text("Riwayat Selesai", style = MaterialTheme.typography.headlineMedium, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold)
        Spacer(modifier = Modifier.height(16.dp))

        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        } else if (historyTrips.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("Belum ada riwayat tugas.", color = Color.Gray)
            }
        } else {
            LazyColumn(modifier = Modifier.fillMaxSize()) {
                items(historyTrips) { trip ->
                    TripCard(trip, onClick = onTripClick)
                }
            }
        }
    }
}

@Composable
fun ServiceControlBar(
    onStart: () -> Unit,
    onStop: () -> Unit,
    onLogout: () -> Unit
) {
    var isTracking by remember { mutableStateOf(false) }

    val permissions = mutableListOf(
        Manifest.permission.ACCESS_FINE_LOCATION,
        Manifest.permission.ACCESS_COARSE_LOCATION
    )
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        permissions.add(Manifest.permission.POST_NOTIFICATIONS)
    }

    val launcher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        if (results.values.all { it }) {
            isTracking = true
            onStart()
        }
    }

    Surface(
        color = MaterialTheme.colorScheme.primaryContainer,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(16.dp).statusBarsPadding(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Image(
                    painter = painterResource(id = R.drawable.wellen_logo),
                    contentDescription = null,
                    modifier = Modifier.size(40.dp).padding(end = 8.dp)
                )
            Column {
                val uid = FirebaseAuth.getInstance().currentUser?.uid ?: ""
                Text(
                    text = if (isTracking) "Tracking Aktif" else "Tracking Berhenti",
                    style = MaterialTheme.typography.titleMedium
                )
                Text(
                    text = "ID: ${uid.take(8)}...",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                )
                TextButton(onClick = onLogout, contentPadding = PaddingValues(0.dp)) {
                    Text("Logout", style = MaterialTheme.typography.bodySmall)
                }
            }
            }
            
            Switch(
                checked = isTracking,
                onCheckedChange = { checked ->
                    if (checked) {
                        launcher.launch(permissions.toTypedArray())
                    } else {
                        isTracking = false
                        onStop()
                    }
                }
            )
        }
    }
}
