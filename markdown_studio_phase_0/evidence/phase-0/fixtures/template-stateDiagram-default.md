```mermaid
stateDiagram-v2
  [*] --> PendingPayment
  PendingPayment --> Processing : Payment Verified
  PendingPayment --> Cancelled : Payment Failed / Timeout
  
  state Processing {
    [*] --> Packaging
    Packaging --> QualityCheck
    QualityCheck --> ReadyForDispatch
  }
  
  Processing --> Shipped : Carrier Picked Up
  Shipped --> OutForDelivery : Local Hub
  OutForDelivery --> Delivered : Customer Signed
  Delivered --> [*]
  Cancelled --> [*]
```
