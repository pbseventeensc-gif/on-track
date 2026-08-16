package com.KurirKita.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.automirrored.filled.ArrowForwardIos
import androidx.compose.material.icons.filled.LocalShipping
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.KurirKita.model.Trip

@Composable
fun TripListScreen(viewModel: TripViewModel, onTripClick: (Trip) -> Unit) {
    val trips by viewModel.trips.collectAsState()
    val isRefreshing by viewModel.isRefreshing.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF1F2F6))
            .padding(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    "Tugas Pengiriman", 
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.ExtraBold,
                    color = Color(0xFF2C3E50)
                )
                val sdf = java.text.SimpleDateFormat("EEEE, dd MMM yyyy", java.util.Locale("id"))
                Text(
                    text = sdf.format(java.util.Date()),
                    style = MaterialTheme.typography.labelSmall,
                    color = Color.Gray
                )
            }
            IconButton(
                onClick = { viewModel.refresh() },
                modifier = Modifier.background(Color.White, androidx.compose.foundation.shape.CircleShape)
            ) {
                if (isRefreshing) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp, color = Color(0xFFD32F2F))
                } else {
                    Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = Color(0xFFD32F2F))
                }
            }
        }
        
        Spacer(modifier = Modifier.height(20.dp))
        
        if (trips.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.LocalShipping, contentDescription = null, modifier = Modifier.size(80.dp), tint = Color.LightGray)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Belum ada rute aktif.", color = Color.Gray, style = MaterialTheme.typography.bodyLarge)
                    TextButton(onClick = { viewModel.refresh() }) {
                        Text("Refresh Halaman", color = Color(0xFFD32F2F), fontWeight = FontWeight.Bold)
                    }
                }
            }
        } else {
            LazyColumn(modifier = Modifier.fillMaxSize()) {
                items(trips) { trip ->
                    TripCard(trip, onTripClick)
                }
            }
        }
    }
}

@Composable
fun TripCard(trip: Trip, onClick: (Trip) -> Unit) {
    Card(
        onClick = { onClick(trip) },
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp)
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                val firstDest = trip.destinations.firstOrNull()?.locationName ?: "Tujuan Baru"
                Surface(
                    color = Color(0xFFD32F2F).copy(alpha = 0.1f),
                    shape = androidx.compose.foundation.shape.CircleShape,
                    modifier = Modifier.size(40.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(Icons.Default.LocalShipping, contentDescription = null, tint = Color(0xFFD32F2F), modifier = Modifier.size(20.dp))
                    }
                }
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Text(
                        text = firstDest,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.ExtraBold,
                        color = Color(0xFF2C3E50)
                    )
                    Text(
                        text = "ID: ${trip.tripId.takeLast(8)} • ${trip.destinations.size} Titik Antar",
                        style = MaterialTheme.typography.labelSmall,
                        color = Color.Gray
                    )
                }
            }
            
            HorizontalDivider(modifier = Modifier.padding(vertical = 16.dp), thickness = 0.5.dp, color = Color(0xFFEEEEEE))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                val statusColor = when(trip.status) {
                    "assigned" -> Color(0xFF7F8C8D)
                    "accepted" -> Color(0xFFF1C40F)
                    "in_progress" -> Color(0xFF3498DB)
                    else -> Color(0xFF2ECC71)
                }
                
                Surface(
                    color = statusColor.copy(alpha = 0.1f),
                    shape = androidx.compose.foundation.shape.RoundedCornerShape(6.dp)
                ) {
                    Text(
                        text = trip.status.uppercase(),
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold,
                        color = statusColor
                    )
                }
                
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Klik Detail", style = MaterialTheme.typography.labelLarge, color = Color(0xFFD32F2F), fontWeight = FontWeight.Bold)
                    Icon(Icons.AutoMirrored.Filled.ArrowForwardIos, contentDescription = null, tint = Color(0xFFD32F2F), modifier = Modifier.size(12.dp).padding(start = 4.dp))
                }
            }
        }
    }
}
