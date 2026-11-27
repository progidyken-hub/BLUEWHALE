import 'package:flutter/material.dart';
import 'package:bluewhale_core/bluewhale_core.dart';

void main() {
  runApp(const DepositWalletApp());
}

class DepositWalletApp extends StatelessWidget {
  const DepositWalletApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Stellar Deposit Wallet',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),
        useMaterial3: true,
      ),
      home: const DepositScreen(),
    );
  }
}

class DepositScreen extends StatefulWidget {
  const DepositScreen({super.key});

  @override
  State<DepositScreen> createState() => _DepositScreenState();
}

class _DepositScreenState extends State<DepositScreen> {
  final _addressController = TextEditingController();
  final _memoController = TextEditingController();
  String _selectedMemoType = 'id';
  RoutingResult? _routingResult;
  String? _errorMessage;

  @override
  void dispose() {
    _addressController.dispose();
    _memoController.dispose();
    super.dispose();
  }

  void _analyzeAddress() {
    setState(() {
      _errorMessage = null;
      _routingResult = null;

      final address = _addressController.text.trim();
      if (address.isEmpty) {
        _errorMessage = 'Please enter an address';
        return;
      }

      try {
        _routingResult = extractRoutingSync(RoutingInput(
          destination: address,
          memoType: _memoController.text.isNotEmpty ? _selectedMemoType : null,
          memoValue: _memoController.text.isNotEmpty ? _memoController.text : null,
        ));
      } catch (e) {
        _errorMessage = 'Error: $e';
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Stellar Deposit Address'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Address Input
              TextField(
                controller: _addressController,
                decoration: const InputDecoration(
                  labelText: 'Destination Address',
                  hintText: 'G... or M... address',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.account_balance_wallet),
                ),
                onChanged: (_) => _analyzeAddress(),
              ),
              const SizedBox(height: 16),

              // Memo Type Selector
              Row(
                children: [
                  const Text('Memo Type:'),
                  const SizedBox(width: 16),
                  Expanded(
                    child: SegmentedButton<String>(
                      segments: const [
                        ButtonSegment(value: 'id', label: Text('ID')),
                        ButtonSegment(value: 'text', label: Text('Text')),
                      ],
                      selected: {_selectedMemoType},
                      onSelectionChanged: (Set<String> selection) {
                        setState(() {
                          _selectedMemoType = selection.first;
                          _analyzeAddress();
                        });
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Memo Input
              TextField(
                controller: _memoController,
                decoration: const InputDecoration(
                  labelText: 'Memo (optional)',
                  hintText: 'Enter routing ID',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.note),
                ),
                onChanged: (_) => _analyzeAddress(),
              ),
              const SizedBox(height: 16),

              // QR Scanner Mock Button
              OutlinedButton.icon(
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('QR scanner integration would go here'),
                    ),
                  );
                },
                icon: const Icon(Icons.qr_code_scanner),
                label: const Text('Scan QR Code'),
              ),
              const SizedBox(height: 24),

              // Error Display
              if (_errorMessage != null)
                Card(
                  color: Colors.red.shade50,
                  child: Padding(
                    padding: const EdgeInsets.all(12.0),
                    child: Row(
                      children: [
                        const Icon(Icons.error, color: Colors.red),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _errorMessage!,
                            style: const TextStyle(color: Colors.red),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

              // Routing Result Display
              if (_routingResult != null) ...[
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Routing Analysis',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        const Divider(),
                        _buildResultRow('Source', _routingResult!.source.name),
                        if (_routingResult!.idString != null)
                          _buildResultRow('Routing ID', _routingResult!.idString!),
                        const SizedBox(height: 8),
                        if (_routingResult!.warnings.isNotEmpty) ...[
                          const Text(
                            'Warnings:',
                            style: TextStyle(fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 8),
                          ..._routingResult!.warnings.map((warning) {
                            return _buildWarningCard(warning);
                          }),
                        ],
                        if (_routingResult!.destinationError != null)
                          _buildErrorCard(_routingResult!.destinationError!),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildResultRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(
              '$label:',
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
          ),
          Expanded(
            child: Text(value),
          ),
        ],
      ),
    );
  }

  Widget _buildWarningCard(RoutingWarning warning) {
    Color bgColor;
    Color iconColor;
    IconData icon;

    switch (warning.severity) {
      case 'error':
        bgColor = Colors.red.shade50;
        iconColor = Colors.red;
        icon = Icons.error;
        break;
      case 'warn':
        bgColor = Colors.orange.shade50;
        iconColor = Colors.orange;
        icon = Icons.warning;
        break;
      default:
        bgColor = Colors.blue.shade50;
        iconColor = Colors.blue;
        icon = Icons.info;
    }

    return Card(
      color: bgColor,
      margin: const EdgeInsets.only(bottom: 8.0),
      child: Padding(
        padding: const EdgeInsets.all(12.0),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: iconColor, size: 20),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    warning.code,
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: iconColor,
                    ),
                  ),
                  Text(warning.message),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorCard(DestinationError error) {
    return Card(
      color: Colors.red.shade50,
      child: Padding(
        padding: const EdgeInsets.all(12.0),
        child: Row(
          children: [
            const Icon(Icons.error, color: Colors.red),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    error.code,
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      color: Colors.red,
                    ),
                  ),
                  Text(error.message),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
