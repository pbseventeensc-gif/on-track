package com.KurirKita.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.KurirKita.model.Trip

@Composable
fun TripListScreen(viewModel: TripViewModel, onTripClick: (Trip) -> Unit) {
    val trips by viewModel.trips.collectAsState()
    val isRefreshing by viewModel.isRefreshing.collectAsState()

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Tugas Pengantaran", style = MaterialTheme.typography.headlineMedium)
            IconButton(onClick = { viewModel.refresh() }) {
                if (isRefreshing) {
                    CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 2.dp)
                } else {
                    Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                }
            }
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        
        if (trips.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("Tidak ada tugas saat ini.")
                    TextButton(onClick = { viewModel.refresh() }) {
                        Text("Cek Ulang")
                    }
                }
            }
        } else {
            LazyColumn(modifier = Modifier.fillMaxSize()) {
                items(trips) { trip ->
                    Card(
                        onClick = { onTripClick(trip) },
                        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            val firstDest = trip.destinations.firstOrNull()?.locationName ?: "Tanpa Tujuan"
                            Text(
                                text = "Tujuan Utama: $firstDest",
                                style = MaterialTheme.typography.titleLarge,
                                color = MaterialTheme.colorScheme.primary
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Trip ID: ${trip.tripId.takeLast(8)}",
                                style = MaterialTheme.typography.bodySmall
                            )
                            Divider(modifier = Modifier.padding(vertical = 8.dp), color = MaterialTheme.colorScheme.outlineVariant)
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("Total: ${trip.destinations.size} Titik", style = MaterialTheme.typography.bodyMedium)
                                Badge(containerColor = if(trip.status == "assigned") Color.Gray else Color(0xFFF1C40F)) {
                                    Text(trip.status.uppercase(), modifier = Modifier.padding(horizontal = 4.dp))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
