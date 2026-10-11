// Mentor publisher EA. Install only on the source account terminal.
#property strict
#property version "1.00"

input string BridgeUrl = "https://skud.toporapula.dev";
input string MentorId = "mentor-skud-01";
input string MentorName = "SkudTurbo";
input string MentorToken = "";
input int RetrySeconds = 2;

string g_pending_events[];

int OnInit()
{
   if(StringLen(BridgeUrl) < 8 || StringLen(MentorId) < 3 || StringLen(MentorName) < 1 ||
      StringLen(MentorToken) < 32 || RetrySeconds < 1)
      return INIT_PARAMETERS_INCORRECT;
   EventSetTimer(RetrySeconds);
   Print("SkuD Mentor EA ready for ", MentorName, " (", MentorId, "). MT5 login: ",
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
   if(ArraySize(g_pending_events) == 0)
      return;
   string response;
   int status;
   if(!SendRequest(g_pending_events[0], response, status))
      return;
   if(status == 200 || status == 202)
   {
      for(int index = 1; index < ArraySize(g_pending_events); index++)
         g_pending_events[index - 1] = g_pending_events[index];
      ArrayResize(g_pending_events, ArraySize(g_pending_events) - 1);
      return;
   }
   if(status >= 400 && status < 500)
   {
      Print("Mentor trade event rejected, HTTP ", status, ": ", response,
            ". Check mentor registration, account, and token.");
      for(int index = 1; index < ArraySize(g_pending_events); index++)
         g_pending_events[index - 1] = g_pending_events[index];
      ArrayResize(g_pending_events, ArraySize(g_pending_events) - 1);
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

bool SendRequest(const string body, string &response, int &http_status)
{
   char data[];
   char result[];
   string result_headers;
   StringToCharArray(body, data, 0, WHOLE_ARRAY, CP_UTF8);
   if(ArraySize(data) > 0 && data[ArraySize(data) - 1] == 0)
      ArrayResize(data, ArraySize(data) - 1);
   string headers = "Authorization: Bearer " + MentorToken + "\r\nContent-Type: application/json\r\n";
   ResetLastError();
   http_status = WebRequest("POST", BridgeUrl + "/v1/mentor/events", headers, 5000,
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
