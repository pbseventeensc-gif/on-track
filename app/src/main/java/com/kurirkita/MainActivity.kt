package com.KurirKita

import android.Manifest
import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.view.ViewGroup
import android.webkit.*
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.addCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import com.cloudinary.android.MediaManager
import java.io.File

class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView
    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null
    private var cameraPhotoUri: Uri? = null

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (fileUploadCallback == null) return@registerForActivityResult
        var results: Array<Uri>? = null
        if (result.resultCode == RESULT_OK) {
            val dataString = result.data?.dataString
            val clipData = result.data?.clipData
            if (clipData != null) {
                results = Array(clipData.itemCount) { i -> clipData.getItemAt(i).uri }
            } else if (dataString != null) {
                results = arrayOf(Uri.parse(dataString))
            } else if (cameraPhotoUri != null) {
                results = arrayOf(cameraPhotoUri!!)
            }
        }
        fileUploadCallback?.onReceiveValue(results)
        fileUploadCallback = null
        cameraPhotoUri = null
    }

    private val requestPermissionsLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        if (grants[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
            grants[Manifest.permission.ACCESS_COARSE_LOCATION] == true) {
            startBackgroundTrackingService()
        }
    }

    private fun startBackgroundTrackingService() {
        try {
            val serviceIntent = Intent(this, TrackingService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent)
            } else {
                startService(serviceIntent)
            }
        } catch (e: Exception) {}
    }

    private val onDownloadComplete = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1)
            if (id != -1L) {
                installApk(context)
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled", "UnspecifiedRegisterReceiverFlag")
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

        checkAndRequestPermissions()

        setupWebView()

        onBackPressedDispatcher.addCallback(this) {
            if (::webView.isInitialized && webView.canGoBack()) {
                webView.goBack()
            } else {
                finish()
            }
        }
    }

    private fun checkAndRequestPermissions() {
        val permissions = mutableListOf(
            Manifest.permission.CAMERA,
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.READ_MEDIA_IMAGES)
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            permissions.add(Manifest.permission.READ_EXTERNAL_STORAGE)
        }

        val needed = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (needed.isNotEmpty()) {
            requestPermissionsLauncher.launch(needed.toTypedArray())
        } else {
            startBackgroundTrackingService()
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        webView = WebView(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                setGeolocationEnabled(true)
                allowFileAccess = true
                allowContentAccess = true
                allowFileAccessFromFileURLs = true
                allowUniversalAccessFromFileURLs = true
                useWideViewPort = true
                loadWithOverviewMode = true
                mediaPlaybackRequiresUserGesture = false
                cacheMode = WebSettings.LOAD_DEFAULT
            }

            webChromeClient = object : WebChromeClient() {
                override fun onGeolocationPermissionsShowPrompt(
                    origin: String?,
                    callback: GeolocationPermissions.Callback?
                ) {
                    callback?.invoke(origin, true, false)
                }

                override fun onPermissionRequest(request: PermissionRequest?) {
                    runOnUiThread {
                        request?.grant(request.resources)
                    }
                }

                override fun onShowFileChooser(
                    mWebView: WebView?,
                    filePathCallback: ValueCallback<Array<Uri>>?,
                    fileChooserParams: FileChooserParams?
                ): Boolean {
                    fileUploadCallback?.onReceiveValue(null)
                    fileUploadCallback = filePathCallback
                    cameraPhotoUri = null

                    val isCapture = fileChooserParams?.isCaptureEnabled == true
                    var captureIntent: Intent? = null

                    try {
                        val photoFile = File.createTempFile(
                            "POD_${System.currentTimeMillis()}_",
                            ".jpg",
                            cacheDir
                        )
                        cameraPhotoUri = FileProvider.getUriForFile(
                            this@MainActivity,
                            "${packageName}.fileprovider",
                            photoFile
                        )
                        captureIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
                            putExtra(MediaStore.EXTRA_OUTPUT, cameraPhotoUri)
                            addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        }
                    } catch (e: Exception) {
                        cameraPhotoUri = null
                    }

                    val finalIntent: Intent = if (isCapture && captureIntent != null) {
                        captureIntent
                    } else {
                        val contentIntent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                            type = "image/*"
                        }
                        if (captureIntent != null) {
                            Intent.createChooser(contentIntent, "Pilih Sumber Foto").apply {
                                putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(captureIntent))
                            }
                        } else {
                            contentIntent
                        }
                    }

                    try {
                        fileChooserLauncher.launch(finalIntent)
                    } catch (e: Exception) {
                        fileUploadCallback = null
                        cameraPhotoUri = null
                        return false
                    }
                    return true
                }
            }

            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                    val url = request?.url?.toString() ?: return false
                    if (url.startsWith("tel:") || url.startsWith("whatsapp:") || url.startsWith("https://wa.me") || url.startsWith("https://api.whatsapp.com")) {
                        try {
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                            startActivity(intent)
                            return true
                        } catch (e: Exception) {
                            Toast.makeText(this@MainActivity, "Aplikasi tidak ditemukan", Toast.LENGTH_SHORT).show()
                            return true
                        }
                    }
                    return false
                }
            }

            addJavascriptInterface(AndroidBridge(), "AndroidBridge")
        }

        setContentView(webView)

        // Load kurir.html directly from bundled assets
        webView.loadUrl("file:///android_asset/kurir.html")
    }

    inner class AndroidBridge {
        @JavascriptInterface
        fun shareCardToWhatsApp(base64Data: String, captionText: String) {
            runOnUiThread {
                try {
                    val cleanBase64 = base64Data.substringAfter("base64,", base64Data)
                    val bytes = Base64.decode(cleanBase64, Base64.DEFAULT)
                    val baseCache = externalCacheDir ?: cacheDir
                    val shareDir = File(baseCache, "wa_cards")
                    if (!shareDir.exists()) shareDir.mkdirs()

                    // Hanya bersihkan file lama (> 2 jam) agar file yang sedang diupload WhatsApp tidak terhapus
                    val now = System.currentTimeMillis()
                    shareDir.listFiles()?.forEach { oldFile ->
                        try {
                            if (now - oldFile.lastModified() > 7200_000L) {
                                oldFile.delete()
                            }
                        } catch (_: Exception) {}
                    }

                    val cardFile = File(shareDir, "Wellen_Bukti_Tiba_${now}.jpg")
                    val decodedBitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                    if (decodedBitmap != null) {
                        cardFile.outputStream().use { out ->
                            decodedBitmap.compress(Bitmap.CompressFormat.JPEG, 92, out)
                            out.flush()
                        }
                    } else {
                        cardFile.writeBytes(bytes)
                    }

                    val contentUri = FileProvider.getUriForFile(
                        this@MainActivity,
                        "${packageName}.fileprovider",
                        cardFile
                    )

                    val pm = packageManager
                    val waPackages = listOf("com.whatsapp", "com.whatsapp.w4b")
                    val installedWa = waPackages.firstOrNull { pkg ->
                        try {
                            pm.getPackageInfo(pkg, 0)
                            true
                        } catch (_: Exception) {
                            false
                        }
                    }

                    // Berikan izin baca URI eksplisit ke proses background WhatsApp agar upload gambar instan & tidak muter-muter
                    waPackages.forEach { pkg ->
                        try {
                            grantUriPermission(pkg, contentUri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        } catch (_: Exception) {}
                    }

                    val sendIntent = Intent(Intent.ACTION_SEND).apply {
                        type = "image/jpeg"
                        putExtra(Intent.EXTRA_STREAM, contentUri)
                        putExtra(Intent.EXTRA_TEXT, captionText)
                        clipData = ClipData.newRawUri("Kartu Bukti Pengiriman", contentUri)
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }

                    if (installedWa != null) {
                        sendIntent.setPackage(installedWa)
                        startActivity(sendIntent)
                    } else {
                        startActivity(Intent.createChooser(sendIntent, "Kirim Kartu Bukti via WhatsApp"))
                    }
                } catch (e: Exception) {
                    Toast.makeText(this@MainActivity, "Gagal mengirim kartu WA: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
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

    override fun onDestroy() {
        super.onDestroy()
        try { unregisterReceiver(onDownloadComplete) } catch (e: Exception) {}
    }
}
