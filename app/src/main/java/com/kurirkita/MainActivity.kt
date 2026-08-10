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
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.KurirKita.ui.theme.KurirKitaTheme

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            KurirKitaTheme {
                Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
                    CourierControlScreen(
                        modifier = Modifier.padding(innerPadding),
                        onStart = { startTrackingService() },
                        onStop = { stopTrackingService() }
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
}

@Composable
fun CourierControlScreen(
    modifier: Modifier = Modifier,
    onStart: () -> Unit,
    onStop: () -> Unit
) {
    var isRunning by remember { mutableStateOf(false) } // Ini hanya untuk UI sederhana

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
            isRunning = true
            onStart()
        }
    }

    Column(
        modifier = modifier.fillMaxSize(),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("Aplikasi KurirKita", style = MaterialTheme.typography.headlineLarge)
        Spacer(modifier = Modifier.height(24.dp))
        
        if (!isRunning) {
            Button(
                onClick = { launcher.launch(permissions.toTypedArray()) },
                modifier = Modifier.fillMaxWidth(0.7f)
            ) {
                Text("Mulai Tugas (Background)")
            }
        } else {
            Button(
                onClick = { 
                    isRunning = false
                    onStop() 
                },
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                modifier = Modifier.fillMaxWidth(0.7f)
            ) {
                Text("Hentikan Tugas")
            }
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = if (isRunning) "Status: Berjalan di background" else "Status: Berhenti",
            style = MaterialTheme.typography.bodyMedium
        )
    }
}
