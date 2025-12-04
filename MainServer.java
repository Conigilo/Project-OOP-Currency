import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;
import java.io.*;
import java.net.InetSocketAddress;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.file.Files;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.Collections;
import org.json.JSONObject;

interface RateProvider {
    double getRate(String from, String to) throws IOException;
}

class ApiRateProvider implements RateProvider {
    @Override
    public double getRate(String from, String to) throws IOException {
        if (from.equalsIgnoreCase(to))
            return 1.0;
        String api = "https://api.frankfurter.dev/v1/latest?base=" + from + "&symbols=" + to;
        HttpURLConnection conn = (HttpURLConnection) new URL(api).openConnection();
        conn.setRequestMethod("GET");
        conn.setConnectTimeout(5000);
        BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream()));
        StringBuilder json = new StringBuilder();
        String line;
        while ((line = br.readLine()) != null)
            json.append(line);
        br.close();
        JSONObject obj = new JSONObject(json.toString());
        if (!obj.has("rates") || !obj.getJSONObject("rates").has(to))
            throw new IOException("Rate not found");
        return obj.getJSONObject("rates").getDouble(to);
    }
}

class Account {
    private double usdBalance = 0.0;
    private Map<String, Double> foreignHoldings = new HashMap<>();
    private RateProvider rateProvider;

    public Account(RateProvider rateProvider) {
        this.rateProvider = rateProvider;
    }

    public double getUsdBalance() {
        return this.usdBalance;
    }

    public Map<String, Double> getForeignHoldings() {
        return Collections.unmodifiableMap(this.foreignHoldings);
    }

    public String deposit(double amount, String currency) throws IOException {
        if (amount <= 0)
            return "จำนวนเงินต้องมากกว่า 0";
        if (currency.equalsIgnoreCase("USD"))
            usdBalance += amount;
        else {
            try {
                rateProvider.getRate(currency, "USD");
            } catch (IOException e) {
                return "สกุลเงินไม่ถูกต้อง";
            }
            foreignHoldings.put(currency, foreignHoldings.getOrDefault(currency, 0.0) + amount);
        }
        return "Success";
    }

    public String withdraw(double amount, String currency) {
        if (amount <= 0)
            return "จำนวนเงินต้องมากกว่า 0";
        if (currency.equalsIgnoreCase("USD")) {
            if (amount > usdBalance)
                return "จำนวนเงินไม่เพียงพอใน USD";
            usdBalance -= amount;
        } else {
            if (!foreignHoldings.containsKey(currency))
                return "ไม่มี " + currency;
            if (amount > foreignHoldings.get(currency))
                return "จำนวนเงินไม่เพียงพอใน " + currency;
            foreignHoldings.put(currency, foreignHoldings.get(currency) - amount);
            if (foreignHoldings.get(currency) <= 0)
                foreignHoldings.remove(currency);
        }
        return "Success";
    }

    public String exchangeTo(String target, double amountUSD) throws IOException {
        if (amountUSD <= 0)
            return "Error: Amount > 0";
        if (amountUSD > usdBalance)
            return "จำนวนเงินไม่เพียงพอใน USD";
        double rate = rateProvider.getRate("USD", target);
        double foreignAmount = amountUSD * rate;
        usdBalance -= amountUSD;
        foreignHoldings.put(target, foreignHoldings.getOrDefault(target, 0.0) + foreignAmount);
        return "Bought " + String.format("%.2f", foreignAmount) + " " + target;
    }

    public String exchangeFrom(String source, double amountForeign) throws IOException {
        if (amountForeign <= 0)
            return "จำนวนเงินต้องมากกว่า 0";
        if (!foreignHoldings.containsKey(source) || foreignHoldings.get(source) < amountForeign)
            return "จำนวนเงินไม่เพียงพอใน " + source;
        double rate = rateProvider.getRate(source, "USD");
        double usdAmount = amountForeign * rate;
        foreignHoldings.put(source, foreignHoldings.get(source) - amountForeign);
        if (foreignHoldings.get(source) <= 0)
            foreignHoldings.remove(source);
        usdBalance += usdAmount;
        return "Sold for " + String.format("%.2f", usdAmount) + " USD";
    }

    public double getTotalWorthInUSD() {
        double total = this.usdBalance;
        for (Map.Entry<String, Double> entry : foreignHoldings.entrySet()) {
            try {
                total += entry.getValue() * rateProvider.getRate(entry.getKey(), "USD");
            } catch (Exception e) {
            }
        }
        return total;
    }
}

public class MainServer {
    static RateProvider provider = new ApiRateProvider();
    static Account account = new Account(provider);

    public static void main(String[] args) throws IOException {
        int port = 8080;
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.createContext("/", new StaticFileHandler());
        server.createContext("/api/action", new ApiHandler());
        server.setExecutor(null);
        System.out.println("✅ SERVER STARTED: http://localhost:" + port);
        server.start();
    }

    static class StaticFileHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange t) throws IOException {
            String path = t.getRequestURI().getPath();
            if (path.equals("/"))
                path = "/index.html";
            File file = new File("public" + path);
            if (file.exists()) {
                String ct = "text/plain";
                if (path.endsWith(".html"))
                    ct = "text/html";
                else if (path.endsWith(".css"))
                    ct = "text/css";
                else if (path.endsWith(".js"))
                    ct = "application/javascript";
                t.getResponseHeaders().set("Content-Type", ct);
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
            Map<String, String> params = new HashMap<>();
            if (query != null)
                for (String p : query.split("&")) {
                    String[] s = p.split("=");
                    if (s.length > 1)
                        params.put(s[0], s[1]);
                }

            String action = params.get("action");
            JSONObject json = new JSONObject();
            String message = "";

            try {
                if ("getRate".equals(action)) {
                    json.put("rate", provider.getRate(params.get("base"), params.get("target")));
                } else if ("getHistory".equals(action)) {
                    String target = params.get("target");
                    LocalDate end = LocalDate.now();
                    LocalDate start = end.minusDays(30);
                    String api = "https://api.frankfurter.dev/v1/" + start + ".." + end + "?base=USD&symbols=" + target;
                    HttpURLConnection conn = (HttpURLConnection) new URL(api).openConnection();
                    BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = br.readLine()) != null)
                        sb.append(line);
                    t.getResponseHeaders().set("Content-Type", "application/json");
                    t.sendResponseHeaders(200, sb.length());
                    OutputStream os = t.getResponseBody();
                    os.write(sb.toString().getBytes());
                    os.close();
                    return;
                } else {
                    if ("deposit".equals(action))
                        message = account.deposit(Double.parseDouble(params.get("amount")), params.get("currency"));
                    else if ("withdraw".equals(action))
                        message = account.withdraw(Double.parseDouble(params.get("amount")), params.get("currency"));
                    else if ("exchange".equals(action))
                        message = account.exchangeTo(params.get("target"), Double.parseDouble(params.get("amount")));
                    else if ("exchangeBack".equals(action))
                        message = account.exchangeFrom(params.get("source"), Double.parseDouble(params.get("amount")));
                    else if ("check".equals(action))
                        message = "Updated";

                    if (message.startsWith("Error"))
                        json.put("error", message);
                    else
                        json.put("msg", message);
                }
            } catch (Exception e) {
                json.put("error", e.getMessage());
            }

            json.put("totalWorth", account.getTotalWorthInUSD());
            json.put("usd", account.getUsdBalance());
            json.put("foreign", account.getForeignHoldings());

            String response = json.toString();
            t.getResponseHeaders().set("Content-Type", "application/json");
            t.sendResponseHeaders(200, response.length());
            OutputStream os = t.getResponseBody();
            os.write(response.getBytes());
            os.close();
        }
    }
}