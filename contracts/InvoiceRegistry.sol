// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract InvoiceRegistry {

    struct Invoice {
        uint256 jobId;
        uint256 invoiceNumber;
        address client;
        address freelancer;
        uint256 amount;
        string ipfsHash;
        uint256 createdAt;
        bool paid;
    }

    uint256 private _nextInvoiceNumber = 1001;
    mapping(uint256 => Invoice) public invoices;
    mapping(uint256 => uint256) public jobInvoice;
    mapping(address => uint256[]) public clientInvoices;
    mapping(address => uint256[]) public freelancerInvoices;

    address public escrowContract;

    event InvoiceCreated(uint256 indexed invoiceNumber, uint256 indexed jobId, address client, address freelancer, uint256 amount);
    event InvoiceMarkedPaid(uint256 indexed invoiceNumber, uint256 indexed jobId);

    constructor(address _escrow) {
        escrowContract = _escrow;
    }

    function createInvoice(
        uint256 jobId,
        address client,
        address freelancer,
        uint256 amount,
        string calldata ipfsHash
    ) external returns (uint256 invoiceNumber) {
        invoiceNumber = _nextInvoiceNumber++;

        invoices[invoiceNumber] = Invoice({
            jobId: jobId,
            invoiceNumber: invoiceNumber,
            client: client,
            freelancer: freelancer,
            amount: amount,
            ipfsHash: ipfsHash,
            createdAt: block.timestamp,
            paid: false
        });

        jobInvoice[jobId] = invoiceNumber;
        clientInvoices[client].push(invoiceNumber);
        if (freelancer != address(0)) {
            freelancerInvoices[freelancer].push(invoiceNumber);
        }

        emit InvoiceCreated(invoiceNumber, jobId, client, freelancer, amount);
    }

    function markPaid(uint256 invoiceNumber) external {
        invoices[invoiceNumber].paid = true;
        emit InvoiceMarkedPaid(invoiceNumber, invoices[invoiceNumber].jobId);
    }

    function getInvoice(uint256 invoiceNumber) external view returns (Invoice memory) {
        return invoices[invoiceNumber];
    }

    function getClientInvoices(address client) external view returns (uint256[] memory) {
        return clientInvoices[client];
    }

    function getFreelancerInvoices(address freelancer) external view returns (uint256[] memory) {
        return freelancerInvoices[freelancer];
    }
}
