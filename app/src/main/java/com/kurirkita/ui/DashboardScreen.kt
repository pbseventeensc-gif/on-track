package com.KurirKita.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.KurirKita.ui.theme.*

data class DashboardState(
    val earnings: String = "0.00",
    val totalAmountCollected: String = "0",
    val totalDistanceCovered: String = "0.0KM",
    val totalOrderDelivered: String = "0",
    val totalOrderRejected: String = "0",
    val activeShipments: String = "0",
    val courierId: String = "",
    val statusMessage: String = "Waiting for orders..."
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    state: DashboardState = DashboardState(),
    onMenuClick: () -> Unit = {},
    onNotificationClick: () -> Unit = {},
    onCheckInClick: () -> Unit = {}
) {
    var selectedFilter by remember { mutableStateOf("Daily") }
    val filters = listOf("Daily", "Weekly", "Today")

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = {
                    Text(
                        "Dashboard",
                        style = MaterialTheme.typography.titleLarge.copy(
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onMenuClick) {
                        Icon(Icons.Default.Menu, contentDescription = "Menu", tint = TextPrimary)
                    }
                },
                actions = {
                    IconButton(onClick = onNotificationClick) {
                        Icon(Icons.Outlined.Notifications, contentDescription = "Notifications", tint = TextPrimary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = SoftWhite
                )
            )
        },
        containerColor = SoftWhite
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 16.dp)
        ) {
            // Filter Pills
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                filters.forEach { filter ->
                    val isSelected = selectedFilter == filter
                    FilterPill(
                        text = filter,
                        isSelected = isSelected,
                        onClick = { selectedFilter = filter }
                    )
                }
            }

            // Main Earnings Card (Restored and set to Rp)
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = CardBackground),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Surface(
                        color = GaugeGreen.copy(alpha = 0.1f),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.padding(bottom = 16.dp)
                    ) {
                        Text(
                            "TODAY EARNING",
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                            style = MaterialTheme.typography.labelMedium.copy(
                                fontWeight = FontWeight.ExtraBold,
                                color = GaugeGreen,
                                letterSpacing = 1.sp
                            )
                        )
                    }

                    Box(contentAlignment = Alignment.TopStart) {
                        Text(
                            "Rp",
                            modifier = Modifier.padding(end = 4.dp).offset(x = (-24.dp), y = 8.dp),
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary,
                                fontSize = 20.sp
                            )
                        )
                        Text(
                            "0",
                            style = MaterialTheme.typography.displayMedium.copy(
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary,
                                fontSize = 48.sp
                            )
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Stats Grid
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = CardBackground),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Row(modifier = Modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
                        StatItem(
                            modifier = Modifier.weight(1f),
                            label = "Active Shipments",
                            value = state.activeShipments
                        )
                        VerticalDivider(thickness = 0.5.dp, color = Color.LightGray.copy(alpha = 0.5f))
                        StatItem(
                            modifier = Modifier.weight(1f),
                            label = "Total Distance Covered",
                            value = "0.0KM"
                        )
                    }
                    HorizontalDivider(thickness = 0.5.dp, color = Color.LightGray.copy(alpha = 0.5f))
                    Row(modifier = Modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
                        StatItem(
                            modifier = Modifier.weight(1f),
                            label = "Total Order Delivered",
                            value = "0"
                        )
                        VerticalDivider(thickness = 0.5.dp, color = Color.LightGray.copy(alpha = 0.5f))
                        StatItem(
                            modifier = Modifier.weight(1f),
                            label = "Total Order Rejected",
                            value = "0"
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.weight(1f))

            // Action Section
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    "Start your trip or duty",
                    style = MaterialTheme.typography.bodyMedium.copy(color = TextSecondary),
                    modifier = Modifier.padding(bottom = 16.dp)
                )
                Button(
                    onClick = onCheckInClick,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color.Black)
                ) {
                    Text(
                        "Check-in",
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    )
                }
            }

            // Footer Area
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp)) {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    color = GaugeGreen.copy(alpha = 0.05f),
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp).fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Icon(imageVector = Icons.Default.HourglassEmpty, contentDescription = null, tint = TextSecondary, modifier = Modifier.size(20.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(state.statusMessage, style = MaterialTheme.typography.bodyMedium.copy(color = TextSecondary, fontWeight = FontWeight.Medium))
                    }
                }
                
                // Debug ID & Connection Status
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 8.dp)) {
                    Surface(
                        color = if (state.activeShipments != "-1") Color(0xFF10B981) else Color.Red,
                        shape = CircleShape,
                        modifier = Modifier.size(6.dp)
                    ) {}
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = if (state.activeShipments != "-1") "Sistem Online" else "Sistem Offline (Cek Internet)",
                        style = MaterialTheme.typography.labelSmall,
                        color = if (state.activeShipments != "-1") TextSecondary.copy(alpha = 0.6f) else Color.Red
                    )
                }
                
                Text(
                    text = "ID Kurir: ${state.courierId}",
                    style = MaterialTheme.typography.labelSmall,
                    color = TextSecondary.copy(alpha = 0.4f),
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
        }
    }
}

@Composable
fun FilterPill(
    text: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        shape = CircleShape,
        color = if (isSelected) Color.Black else Color.Transparent,
        border = if (isSelected) null else androidx.compose.foundation.BorderStroke(1.dp, Color.LightGray.copy(alpha = 0.5f)),
        modifier = Modifier.height(40.dp)
    ) {
        Box(
            modifier = Modifier.padding(horizontal = 20.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = text,
                style = MaterialTheme.typography.labelLarge.copy(
                    fontWeight = FontWeight.Bold,
                    color = if (isSelected) Color.White else TextSecondary
                )
            )
        }
    }
}

@Composable
fun StatItem(
    modifier: Modifier = Modifier,
    label: String,
    value: String
) {
    Column(
        modifier = modifier.padding(20.dp),
        horizontalAlignment = Alignment.Start
    ) {
        Text(
            label,
            style = MaterialTheme.typography.labelMedium.copy(
                color = TextSecondary,
                lineHeight = 16.sp
            ),
            modifier = Modifier.padding(bottom = 4.dp)
        )
        Text(
            value,
            style = MaterialTheme.typography.titleLarge.copy(
                fontWeight = FontWeight.Bold,
                color = TextPrimary
            )
        )
    }
}
