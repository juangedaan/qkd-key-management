# Key management skeleton powered by AWS

![image](https://github.com/juangedaan/qkd-key-management/assets/6960588/409a1fe8-dcf4-4f17-a209-1ad4a69c46f0)


## Description

The O2Stack project is an AWS CDK (Cloud Development Kit) stack that sets up a VPC (Virtual Private Cloud) in the AWS Frankfurt region. This stack integrates with AWS Direct Connect to connect to an Equinix data center in Madrid. It leverages Amazon Braket for quantum computing and integrates with a quantum key distribution (QKD) network for secure communication. The setup includes multiple subnets and instances, such as a bastion host for SSH access, a service instance, and an SDN instance with additional network interfaces in the Quantum and Management subnets.This configuration provides a secure and scalable infrastructure for deploying applications within a controlled network environment.

This code base is used by key management companies to deliver QKD-sourced keys to an AWS VPC. In this scenario, a telco takes the outcome of a Minimum Independent Set problem calculated by a quantum computer, and uses the keys to encrypt the data and send the result to a remote location using quantum-resistant communication paths.

## Installation

To install and deploy the O2Stack, follow these steps:

1. **Clone the repository:**

   ```bash
   git clone https://gitlab.aws.dev/qcn/lbt/partner-deployments/O2Stack.git

   cd O2Stack

2. **Install dependencies:**

```bash
npm install
```

3. **Bootstrap your AWS environment:**

```bash
cdk bootstrap
```

4. **Deploy the stack:**

```bash
cdk deploy
```
Ensure you have the necessary AWS credentials configured.

## Usage
Once deployed, the stack will create the following resources:

* VPC with public and private subnets.
* Bastion Host for SSH access.
* Service Instance with a private IP.
* SDN Instance with additional network interfaces in Quantum and Management subnets.
* Security Groups to control access between subnets and instances.
* Elastic IP associated with the Bastion Host.

You can access the bastion host via its Elastic IP and use it to SSH into other instances within the VPC.

## Support
If you encounter any issues or have questions, please open an issue in the GitHub repository. We will respond as promptly as possible.

## Roadmap
Future enhancements for the O2Stack project include:

Adding more security controls and monitoring capabilities.
Integrating with other AWS services like RDS and Lambda.
Providing examples for deploying various types of applications within the VPC.

## Contributing
We welcome contributions to the O2Stack project! If you have an idea or a fix, please:

1. Fork the repository.
2. Create a new branch (git checkout -b feature-branch).
3. Make your changes.
4. Commit your changes (git commit -m 'Add some feature').
5. Push to the branch (git push origin feature-branch).
6. Open a pull request.

Please ensure your code follows AWS coding standards and includes appropriate tests.

## Authors and acknowledgment
Juan Moreno - Initial work


## Project status
The O2Stack project is currently in the initial deployment phase. We are actively working on adding new features and improving the existing ones. Stay tuned for updates!
