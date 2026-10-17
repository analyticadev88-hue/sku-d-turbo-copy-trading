// Mentor publisher EA. Install only on the source account terminal.
#property strict
#property version "1.10"

input string BridgeUrl = "https://skud.toporapula.dev";
input string MentorId = "mentor-skud-01";
input string MentorName = "SkudTurbo";
input string MentorToken = "";
input int RetrySeconds = 2;
input int ReportSeconds = 3;

// Same Deriv coverage as the Student EA 8.10: feeds the admin trade UI and
// the bridge volume_min/max/step clamps. Fixed constant on purpose, so a stale
// chart profile can never resurrect old symbols.
string ReportSymbols = "EURUSD,GBPUSD,USDJPY,USDCHF,USDCAD,AUDUSD,NZDUSD,EURGBP,EURJPY,GBPJPY,EURCHF,EURCAD,EURAUD,EURNZD,GBPCHF,GBPCAD,GBPAUD,GBPNZD,AUDJPY,AUDCHF,AUDCAD,AUDNZD,CADJPY,CADCHF,CHFJPY,NZDJPY,NZDCHF,NZDCAD,XAUUSD,XAGUSD";

string g_pending_events[];
ulong g_last_status_ms = 0;
ulong g_last_report_ms = 0;
ulong g_last_report_warn_ms = 0;
ulong g_last_symbol_warn_ms = 0;

int OnInit()
{
   if(StringLen(BridgeUrl) < 8 || StringLen(MentorId) < 3 || StringLen(MentorName) < 1 ||
      StringLen(MentorToken) < 32 || RetrySeconds < 1 || ReportSeconds < 1)
      return INIT_PARAMETERS_INCORRECT;
   EventSetTimer(RetrySeconds);
   Print("SkuD Mentor EA build 1.10 ready for ", MentorName, " (", MentorId, "). MT5 login: ",
         (long)AccountInfoInteger(ACCOUNT_LOGIN));
   Print("Allow WebRequest for ", BridgeUrl, " in MT5 Options > Expert Advisors.");
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   EventKillTimer();
}

void OnTimer()
{
   if(ArraySize(g_pending_events) > 0)
   {
      string response;
      int status;
      if(SendRequest(g_pending_events[0], response, status))
      {
         if(status == 200 || status == 202)
         {
            for(int index = 1; index < ArraySize(g_pending_events); index++)
               g_pending_events[index - 1] = g_pending_events[index];
            ArrayResize(g_pending_events, ArraySize(g_pending_events) - 1);
         }
         else if(status >= 400 && status < 500)
         {
            Print("Mentor trade event rejected, HTTP ", status, ": ", response,
                  ". Check mentor registration, account, and token.");
            for(int index = 1; index < ArraySize(g_pending_events); index++)
               g_pending_events[index - 1] = g_pending_events[index];
            ArrayResize(g_pending_events, ArraySize(g_pending_events) - 1);
         }
      }
   }

   // Heartbeat + price/position reporting so the admin trade UI gets live
   // quotes and terminal state from THIS (source) account.
   if(GetTickCount64() - g_last_status_ms >= 10000)
   {
      SendStatus();
      g_last_status_ms = GetTickCount64();
   }
   if(TerminalInfoInteger(TERMINAL_CONNECTED) && AccountInfoInteger(ACCOUNT_LOGIN) > 0 &&
      GetTickCount64() - g_last_report_ms >= (ulong)ReportSeconds * 1000)
   {
      g_last_report_ms = GetTickCount64();
      ReportPrices();
   }
}

void OnTradeTransaction(const MqlTradeTransaction &transaction,
                        const MqlTradeRequest &request,
                        const MqlTradeResult &result)
{
   if(transaction.type != TRADE_TRANSACTION_DEAL_ADD || transaction.deal == 0)
      return;
   if(!HistoryDealSelect(transaction.deal))
      return;

   ENUM_DEAL_ENTRY entry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(transaction.deal, DEAL_ENTRY);
   ENUM_DEAL_TYPE deal_type = (ENUM_DEAL_TYPE)HistoryDealGetInteger(transaction.deal, DEAL_TYPE);
   if(deal_type != DEAL_TYPE_BUY && deal_type != DEAL_TYPE_SELL)
      return;

   string event_type = "";
   ulong position_id = (ulong)HistoryDealGetInteger(transaction.deal, DEAL_POSITION_ID);
   if(entry == DEAL_ENTRY_IN)
      event_type = "open";
   else if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_OUT_BY)
   {
      if(HasOpenPosition(position_id))
         return;
      event_type = "close";
   }
   else
   {
      return;
   }

   string side = deal_type == DEAL_TYPE_BUY ? "buy" : "sell";
   string symbol = HistoryDealGetString(transaction.deal, DEAL_SYMBOL);
   double volume = HistoryDealGetDouble(transaction.deal, DEAL_VOLUME);
   string event_id = StringFormat("%I64u", transaction.deal);
   string position_text = StringFormat("%I64u", position_id);
   string body = StringFormat(
      "{\"mentor_id\":\"%s\",\"mentor_name\":\"%s\",\"login\":\"%I64d\","
      "\"server\":\"%s\",\"event_id\":\"%s\",\"position_id\":\"%s\","
      "\"event_type\":\"%s\",\"symbol\":\"%s\",\"side\":\"%s\",\"volume\":%.8f}",
      JsonEscape(MentorId), JsonEscape(MentorName), AccountInfoInteger(ACCOUNT_LOGIN),
      JsonEscape(AccountInfoString(ACCOUNT_SERVER)), event_id, position_text,
      event_type, JsonEscape(symbol), side, volume);
   int size = ArraySize(g_pending_events);
   ArrayResize(g_pending_events, size + 1);
   g_pending_events[size] = body;
}

bool HasOpenPosition(const ulong position_id)
{
   for(int index = 0; index < PositionsTotal(); index++)
   {
      ulong ticket = PositionGetTicket(index);
      if(ticket > 0 && (ulong)PositionGetInteger(POSITION_IDENTIFIER) == position_id)
         return true;
   }
   return false;
}

void SendStatus()
{
   string login = IntegerToString((int)AccountInfoInteger(ACCOUNT_LOGIN));
   string server = AccountInfoString(ACCOUNT_SERVER);
   bool authorized = TerminalInfoInteger(TERMINAL_CONNECTED) &&
                     AccountInfoInteger(ACCOUNT_LOGIN) > 0 &&
                     AccountInfoInteger(ACCOUNT_TRADE_ALLOWED);
   string message = authorized
      ? "MT5 login successful on " + server
      : "MT5 disconnected or login failed on " + server;
   double balance = authorized ? AccountInfoDouble(ACCOUNT_BALANCE) : 0;
   string currency = authorized ? AccountInfoString(ACCOUNT_CURRENCY) : "";
   string body = "{\"login\":\"" + login + "\",\"connected\":" +
                 (authorized ? "true" : "false") +
                 ",\"message\":\"" + JsonEscape(message) + "\"," +
                 "\"server\":\"" + JsonEscape(server) + "\"," +
                 "\"balance\":" + DoubleToString(balance, 2) +
                 ",\"currency\":\"" + JsonEscape(currency) + "\"}";
   string response;
   int status;
   SendRequestTo("/v1/terminal/status", body, response, status);
}

void ReportPrices()
{
   string names[];
   ushort separator = StringGetCharacter(",", 0);
   int count = StringSplit(ReportSymbols, separator, names);
   if(count <= 0)
      return;

   string ticks = "";
   string positions = "";
   string skipped = "";
   int reported = 0;
   for(int i = 0; i < count && reported < 200; i++)
   {
      string name = names[i];
      StringTrimLeft(name);
      StringTrimRight(name);
      if(StringLen(name) == 0)
         continue;
      if(!SymbolSelect(name, true))
      {
         if(StringLen(skipped) > 0) skipped += ", ";
         skipped += name + " (select failed)";
         continue;
      }
      MqlTick tick;
      if(!SymbolInfoTick(name, tick))
      {
         if(StringLen(skipped) > 0) skipped += ", ";
         skipped += name + " (no tick)";
         continue;
      }
      double volume_min = SymbolInfoDouble(name, SYMBOL_VOLUME_MIN);
      double volume_max = SymbolInfoDouble(name, SYMBOL_VOLUME_MAX);
      double volume_step = SymbolInfoDouble(name, SYMBOL_VOLUME_STEP);
      if(reported > 0)
         ticks += ",";
      ticks += "{\"symbol\":\"" + JsonEscape(name) + "\",\"bid\":" + DoubleToString(tick.bid, 8) +
               ",\"ask\":" + DoubleToString(tick.ask, 8) +
               ",\"volume_min\":" + DoubleToString(volume_min, 4) +
               ",\"volume_max\":" + DoubleToString(volume_max, 4) +
               ",\"volume_step\":" + DoubleToString(volume_step, 4) + "}";
      reported++;
   }
   for(int i = PositionsTotal() - 1; i >= 0 && i < 200; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0)
         continue;
      if(StringLen(positions) > 0)
         positions += ",";
      string position_type = PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY ? "buy" : "sell";
      positions += "{\"ticket\":\"" + (string)ticket + "\",\"symbol\":\"" +
                   JsonEscape(PositionGetString(POSITION_SYMBOL)) + "\",\"type\":\"" + position_type +
                   "\",\"volume\":" + DoubleToString(PositionGetDouble(POSITION_VOLUME), 8) + "}";
   }
   if(StringLen(skipped) > 0 && GetTickCount64() - g_last_symbol_warn_ms >= 60000)
   {
      g_last_symbol_warn_ms = GetTickCount64();
      Print("SkuD Mentor EA symbols unavailable in this terminal: ", skipped);
   }
   if(reported == 0)
      return;

   string login = IntegerToString((int)AccountInfoInteger(ACCOUNT_LOGIN));
   string body = "{\"login\":\"" + login + "\",\"ticks\":[" + ticks + "],\"positions\":[" + positions + "]}";
   string response;
   int status;
   SendRequestTo("/v1/prices", body, response, status);
   if(status != 200 && GetTickCount64() - g_last_report_warn_ms >= 60000)
   {
      g_last_report_warn_ms = GetTickCount64();
      Print("SkuD Mentor EA price report failed, HTTP ", status, ", response: ", response);
   }
}

bool SendRequest(const string body, string &response, int &http_status)
{
   return SendRequestTo("/v1/mentor/events", body, response, http_status);
}

bool SendRequestTo(const string path, const string body, string &response, int &http_status)
{
   char data[];
   char result[];
   string result_headers;
   StringToCharArray(body, data, 0, WHOLE_ARRAY, CP_UTF8);
   if(ArraySize(data) > 0 && data[ArraySize(data) - 1] == 0)
      ArrayResize(data, ArraySize(data) - 1);
   string headers = "Authorization: Bearer " + MentorToken + "\r\nContent-Type: application/json\r\n";
   ResetLastError();
   http_status = WebRequest("POST", BridgeUrl + path, headers, 5000,
                            data, result, result_headers);
   if(http_status == -1)
   {
      Print("Mentor WebRequest failed: ", GetLastError(), ". Check MT5 WebRequest allowlist.");
      response = "";
      return false;
   }
   response = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   return true;
}

string JsonEscape(const string value)
{
   string output = "";
   for(int index = 0; index < StringLen(value); index++)
   {
      ushort character = StringGetCharacter(value, index);
      if(character == '"' || character == '\\')
         output += "\\" + ShortToString(character);
      else if(character == '\n')
         output += "\\n";
      else if(character >= 32)
         output += ShortToString(character);
   }
   return output;
}
