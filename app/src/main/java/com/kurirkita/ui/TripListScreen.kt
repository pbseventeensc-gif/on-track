package com.KurirKita.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
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
            .background(Color(0xFFF8F9FA))
            .padding(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    "Tugas Anda", 
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF2C3E50)
                )
                Text(
                    "Daftar pengiriman hari ini",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color.Gray
                )
            }
            IconButton(
                onClick = { viewModel.refresh() },
                colors = IconButtonDefaults.iconButtonColors(containerColor = Color.White)
            ) {
                if (isRefreshing) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                } else {
                    Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = Color(0xFFD32F2F))
                }
            }
        }
        
        Spacer(modifier = Modifier.height(24.dp))
        
        if (trips.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.LocalShipping, contentDescription = null, modifier = Modifier.size(64.dp), tint = Color.LightGray)
                    Text("Belum ada tugas masuk", color = Color.Gray)
                    TextButton(onClick = { viewModel.refresh() }) {
                        Text("Cek Ulang", color = Color(0xFFD32F2F))
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
        shape = androidx.compose.foundation.shape.RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                val firstDest = trip.destinations.firstOrNull()?.locationName ?: "Tujuan Baru"
                Icon(Icons.Default.LocalShipping, contentDescription = null, tint = Color(0xFFD32F2F), modifier = Modifier.size(20.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = firstDest,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
            }
            
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "ID: ${trip.tripId.takeLast(8)} • ${trip.destinations.size} Lokasi",
                style = MaterialTheme.typography.labelSmall,
                color = Color.Gray
            )

            HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp), thickness = 0.5.dp)

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
                    shape = androidx.compose.foundation.shape.RoundedCornerShape(4.dp)
                ) {
                    Text(
                        text = trip.status.uppercase(),
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold,
                        color = statusColor
                    )
                }
                
                Text("Lihat Detail >", style = MaterialTheme.typography.labelLarge, color = Color(0xFFD32F2F))
            }
        }
    }
}
