import UIKit
import WebKit

class ViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    private var webView: WKWebView!
    private var loadingView: UIView!
    private var splashImageView: UIImageView!

    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }

    override func viewDidLoad() {
        super.viewDidLoad()
        setupWebView()
        setupSplash()
        loadApp()
    }

    // MARK: - Setup

    private func setupWebView() {
        let config = WKWebViewConfiguration()
        config.preferences.javaScriptEnabled = true
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        config.setValue(true, forKey: "allowUniversalAccessFromFileURLs")

        let contentController = WKUserContentController()
        // Bridge: receive messages from JS
        contentController.add(self, name: "iosBridge")
        config.userContentController = contentController

        webView = WKWebView(frame: .zero, configuration: config)
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.039, green: 0.039, blue: 0.059, alpha: 1.0)
        webView.scrollView.backgroundColor = .clear
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.bounces = false

        if #available(iOS 16.4, *) {
            webView.isInspectable = true
        }

        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])
    }

    private func setupSplash() {
        loadingView = UIView(frame: view.bounds)
        loadingView.backgroundColor = UIColor(red: 0.039, green: 0.039, blue: 0.059, alpha: 1.0)
        loadingView.autoresizingMask = [.flexibleWidth, .flexibleHeight]

        let gradient = CAGradientLayer()
        gradient.colors = [
            UIColor(red: 0.545, green: 0.369, blue: 0.965, alpha: 1.0).cgColor,
            UIColor(red: 0.231, green: 0.510, blue: 0.965, alpha: 1.0).cgColor
        ]
        gradient.startPoint = CGPoint(x: 0, y: 0)
        gradient.endPoint = CGPoint(x: 1, y: 1)
        gradient.frame = loadingView.bounds
        loadingView.layer.addSublayer(gradient)

        let logoLabel = UILabel()
        logoLabel.text = "AI Nexus"
        logoLabel.font = UIFont.systemFont(ofSize: 32, weight: .heavy)
        logoLabel.textColor = .white
        logoLabel.textAlignment = .center
        logoLabel.translatesAutoresizingMaskIntoConstraints = false

        let loader = UIActivityIndicatorView(style: .large)
        loader.color = .white
        loader.translatesAutoresizingMaskIntoConstraints = false
        loader.startAnimating()

        loadingView.addSubview(logoLabel)
        loadingView.addSubview(loader)
        view.addSubview(loadingView)

        NSLayoutConstraint.activate([
            logoLabel.centerXAnchor.constraint(equalTo: loadingView.centerXAnchor),
            logoLabel.centerYAnchor.constraint(equalTo: loadingView.centerYAnchor, constant: -30),
            loader.centerXAnchor.constraint(equalTo: loadingView.centerXAnchor),
            loader.topAnchor.constraint(equalTo: logoLabel.bottomAnchor, constant: 24)
        ])
    }

    private func loadApp() {
        guard let indexPath = Bundle.main.path(forResource: "index", ofType: "html") else {
            // Fallback: load from remote
            let url = URL(string: "https://production.zhitongwang-backup.pages.dev/")!
            webView.load(URLRequest(url: url))
            return
        }
        let url = URL(fileURLWithPath: indexPath)
        webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
    }

    // MARK: - WKNavigationDelegate

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        UIView.animate(withDuration: 0.4) {
            self.loadingView.alpha = 0
        } completion: { _ in
            self.loadingView.removeFromSuperview()
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        // On load failure with local file, fall back to remote
        guard let url = URL(string: "https://production.zhitongwang-backup.pages.dev/") else { return }
        webView.load(URLRequest(url: url))
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        guard let url = URL(string: "https://production.zhitongwang-backup.pages.dev/") else { return }
        webView.load(URLRequest(url: url))
    }

    // MARK: - WKUIDelegate

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.targetFrame == nil {
            webView.load(navigationAction.request)
        }
        return nil
    }
}

// MARK: - WKScriptMessageHandler (JS Bridge)

extension ViewController: WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "iosBridge" else { return }
        // Handle JS-to-native messages if needed
    }
}
