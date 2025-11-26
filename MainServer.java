import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;
import java.io.*;
import java.net.InetSocketAddress;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.file.Files;
import java.util.HashMap;
import java.util.Map;
import java.util.Scanner;
import org.json.JSONObject;

interface RateProvider {
    double getRate(String from, String to) throws IOException;
}

class ApiRateProvider implements RateProvider {

    @Override
    public double getRate(String from, String to) throws IOException {
        // เพิ่มบรรทัดนี้: ถ้าสกุลเงินเหมือนกัน ให้คืนค่า 1.0 ทันที ไม่ต้องยิง API
        if (from.equalsIgnoreCase(to)) {
            return 1.0;
        }
        String api = "https://api.frankfurter.dev/v1/latest?base=" + from + "&symbols=" + to;

        HttpURLConnection conn = (HttpURLConnection) new URL(api).openConnection();
        conn.setRequestMethod("GET");

        BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream()));
        StringBuilder json = new StringBuilder();
        String line;

        while ((line = br.readLine()) != null) {
            json.append(line);
        }
        br.close();

        JSONObject obj = new JSONObject(json.toString());
        return obj.getJSONObject("rates").getDouble(to);
    }
}

class Account {
    // เปลี่ยนเป็น public เพื่อให้ Server ดึงค่าไปโชว์ได้ง่ายๆ
    public double usdBalance = 0.0;
    public Map<String, Double> foreignHoldings = new HashMap<>();
    private RateProvider rateProvider;

    public Account(RateProvider rateProvider) {
        this.rateProvider = rateProvider;
    }


    public String deposit(double amount, String currency) throws IOException {
        if (amount <= 0) {
            return "Error: Amount must be greater than 0.";
        }
        double rate = rateProvider.getRate(currency, "USD");
        double usd = amount * rate;
        usdBalance += usd;
        return "DEPOSIT: " + amount + " " + currency + " => " + String.format("%.2f", usd) + " USD stored.";
    }

    public String withdraw(double amountUSD) {
        if (amountUSD <= 0) {
            return "Error: Amount must be greater than 0.";
        }
        if (amountUSD > usdBalance) {
            return "Error: Withdraw failed. Not enough USD balance.";
        }
        usdBalance -= amountUSD;
        return "WITHDRAW: " + amountUSD + " USD successful.";
    }

    public String exchangeTo(String targetCurrency, double amountUSD) throws IOException {
        if (amountUSD <= 0) {
            return "Error: Amount must be greater than 0.";
        }
        if (targetCurrency.equalsIgnoreCase("USD")) {
            return "Error: Cannot convert back to USD!";
        }
        if (amountUSD > usdBalance) {
            return "Error: Not enough USD to exchange.";
        }

        double rate = rateProvider.getRate("USD", targetCurrency);
        double foreignAmount = amountUSD * rate;

        usdBalance -= amountUSD;
        foreignHoldings.put(targetCurrency, foreignHoldings.getOrDefault(targetCurrency, 0.0) + foreignAmount);

        return "EXCHANGE: " + amountUSD + " USD => " + String.format("%.2f", foreignAmount) + " " + targetCurrency;
    }

    public String viewrateexchange(String targetCurrency) throws IOException {
        if (targetCurrency.equalsIgnoreCase("USD")) return "Cannot convert back to USD!";
        
        double rate = rateProvider.getRate("USD", targetCurrency);
        double simulatedAmount = (usdBalance > 0) ? usdBalance * rate : 0;
        
        return String.format("Rate (USD->%s): %.4f. Your %.2f USD ≈ %.2f %s", 
               targetCurrency, rate, usdBalance, simulatedAmount, targetCurrency);
    }

    public String exchangeFrom(String sourceCurrency, double amountForeign) throws IOException {
        if (amountForeign <= 0) {
            return "Error: Amount must be greater than 0.";
        }
        if (sourceCurrency.equalsIgnoreCase("USD")) {
            return "Error: Cannot exchange USD from USD!";
        }
        if (!foreignHoldings.containsKey(sourceCurrency) || foreignHoldings.get(sourceCurrency) < amountForeign) {
            return String.format("Error: Not enough %s holdings.", sourceCurrency);
        }

        double rate = rateProvider.getRate(sourceCurrency, "USD");
        double usdAmount = amountForeign * rate;

        foreignHoldings.put(sourceCurrency, foreignHoldings.get(sourceCurrency) - amountForeign);
        if (foreignHoldings.get(sourceCurrency) < 0.0001) {
            foreignHoldings.remove(sourceCurrency);
        }
        usdBalance += usdAmount;

        return String.format("EXCHANGE BACK: %.2f %s => %.2f USD successful.", amountForeign, sourceCurrency, usdAmount);
    }
}

// ==========================================
// ส่วนที่ 2: Server Config (Web Backend)
// ==========================================

public class MainServer {
    // สร้าง Object Account และ Provider ตามแบบเดิมเป๊ะ
    static RateProvider provider = new ApiRateProvider();
    static Account account = new Account(provider);

    public static void main(String[] args) throws IOException {
        int port = 8080;
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);

        // Handler 1: ส่งหน้าเว็บ (HTML/CSS/JS)
        server.createContext("/", new StaticFileHandler());

        // Handler 2: เชื่อมต่อ API กับ Account Class
        server.createContext("/api/action", new ApiHandler());

        server.setExecutor(null);
        System.out.println("🚀 SERVER STARTED: http://localhost:" + port);
        server.start();
    }

    // --- Helper Classes สำหรับ Server ---

    static class StaticFileHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange t) throws IOException {
            String path = t.getRequestURI().getPath();
            if (path.equals("/")) path = "/index.html"; 
            File file = new File("public" + path);

            if (file.exists()) {
                String contentType = "text/plain";
                if (path.endsWith(".html")) contentType = "text/html";
                else if (path.endsWith(".css")) contentType = "text/css";
                else if (path.endsWith(".js")) contentType = "application/javascript";

                t.getResponseHeaders().set("Content-Type", contentType);
                t.sendResponseHeaders(200, file.length());
                OutputStream os = t.getResponseBody();
                Files.copy(file.toPath(), os);
                os.close();
            } else {
                String msg = "404 Not Found";
                t.sendResponseHeaders(404, msg.length());
                OutputStream os = t.getResponseBody();
                os.write(msg.getBytes());
                os.close();
            }
        }
    }

    static class ApiHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange t) throws IOException {
            String query = t.getRequestURI().getQuery();
            Map<String, String> params = queryToMap(query);
            String action = params.get("action");
            
            JSONObject json = new JSONObject();
            String message = "";

            try {
                // เรียกใช้ฟังก์ชันเดิมตาม Action ที่ส่งมา
                if ("deposit".equals(action)) {
                    double amt = Double.parseDouble(params.get("amount"));
                    String curr = params.get("currency");
                    message = account.deposit(amt, curr); // เรียกฟังก์ชันเดิม
                } 
                else if ("withdraw".equals(action)) {
                    double amt = Double.parseDouble(params.get("amount"));
                    message = account.withdraw(amt); // เรียกฟังก์ชันเดิม
                }
                else if ("exchange".equals(action)) { // USD -> Foreign
                    double amt = Double.parseDouble(params.get("amount"));
                    String target = params.get("target");
                    message = account.exchangeTo(target, amt); // เรียกฟังก์ชันเดิม
                }
                else if ("exchangeBack".equals(action)) { // Foreign -> USD
                    double amt = Double.parseDouble(params.get("amount")); // amount foreign
                    String source = params.get("source"); // currency
                    message = account.exchangeFrom(source, amt); // เรียกฟังก์ชันเดิม
                }
                else if ("check".equals(action)) {
                    message = "Updated Portfolio";
                }

                if(message.startsWith("Error")) json.put("error", message);
                else json.put("msg", message);

            } catch (Exception e) {
                json.put("error", "System Error: " + e.getMessage());
            }

            // ส่งข้อมูลล่าสุดกลับไปอัปเดตหน้าจอ
            json.put("usd", account.usdBalance);
            json.put("foreign", account.foreignHoldings);

            String response = json.toString();
            t.getResponseHeaders().set("Content-Type", "application/json");
            t.sendResponseHeaders(200, response.length());
            OutputStream os = t.getResponseBody();
            os.write(response.getBytes());
            os.close();
        }

        private Map<String, String> queryToMap(String query) {
            Map<String, String> result = new HashMap<>();
            if (query == null) return result;
            for (String param : query.split("&")) {
                String[] entry = param.split("=");
                if (entry.length > 1) result.put(entry[0], entry[1]);
            }
            return result;
        }
    }
}