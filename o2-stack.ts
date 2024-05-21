import { Tags, Stack, StackProps, App } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib';
export class O2Stack extends Stack {
	constructor(scope: App, id: string, props?: StackProps) {
		super(scope, id, {
			...props,
			env: {
				account: '093117279452', // Replace with your actual account ID
				region: 'eu-central-1', // Replace with your actual region
			},
		});

		const vpc = new ec2.Vpc(this, 'VPC', {
			cidr: '10.0.0.0/16', // Updated VPC CIDR
			maxAzs: 1, // All subnets will be in the same AZ to match your setup
			subnetConfiguration: [
				{
					cidrMask: 28,
					name: 'BASTION-',
					subnetType: ec2.SubnetType.PUBLIC,
				},
				{
					cidrMask: 28,
					name: 'SERVICE-',
					subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
				},
				{
					cidrMask: 28,
					name: 'QUANTUM-',
					subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
				},
				{
					cidrMask: 28,
					name: 'MANAGEMENT-',
					subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
				},
			],
		});

		// Define CIDR blocks for each subnet type
		const cidrBlocks = {
			'public': '10.0.10.0/28',  // Assuming only one public subnet for the bastion
			'private': ['10.0.20.0/28', '10.0.30.0/28', '10.0.40.0/28']  // Assuming three private subnets
		};

		// Adjust the CIDR block for the public subnet
		if (vpc.publicSubnets[0]?.node.defaultChild instanceof ec2.CfnSubnet) {
			const publicSubnet = vpc.publicSubnets[0].node.defaultChild as ec2.CfnSubnet;
			publicSubnet.addPropertyOverride('CidrBlock', cidrBlocks.public);
		}

		// Loop through the private subnets and assign CIDR blocks
		vpc.privateSubnets.forEach((subnet, index) => {
			if (subnet?.node.defaultChild instanceof ec2.CfnSubnet && cidrBlocks.private[index]) {
				const privateSubnet = subnet.node.defaultChild as ec2.CfnSubnet;
				privateSubnet.addPropertyOverride('CidrBlock', cidrBlocks.private[index]);
			}
		});

		// Bastion Host Security Group and Instance
		const bastionSecurityGroup = new ec2.SecurityGroup(this, 'Bastion-SG-', {
			vpc,
			description: 'Allow SSH access to bastion',
		});
		bastionSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'Allow SSH access from anywhere');

		// Attach an IAM role to the bastion host for S3 access
		const role = new iam.Role(this, 'BastionRole', {
			assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
			managedPolicies: [
				iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3ReadOnlyAccess'),
			],
		});

		const bastion = new ec2.Instance(this, 'BastionHost', {
			vpc,
			instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.XLARGE),
			privateIpAddress: '10.0.10.5',
			machineImage: new ec2.LookupMachineImage({
				name: 'ubuntu/images/hvm-ssd/ubuntu-focal-20.04-amd64-server-*',
				owners: ['099720109477'],
			}),
			vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
			securityGroup: bastionSecurityGroup,
			keyName: 'eu-central-1-upm',
			role: role,
		});

		// User data to set up the bastion host for SSH access to other instances
		bastion.addUserData(`
		#!/bin/bash
		# Set the hostname
		hostnamectl set-hostname bastion
		
		# Update and install AWS CLI
		# apt-get update
		sleep 60
		apt install -y awscli
		
		# Fetch the key from the S3 bucket
		aws s3 cp s3://upm-admin/eu-central-1-upm.pem /home/ubuntu/eu-central-1-upm.pem
		chmod 400 /home/ubuntu/eu-central-1-upm.pem
		
		# Configure SSH to use the key for the specified hostnames and private IPs
		echo "Host endpoint" > /home/ubuntu/.ssh/config
		echo "    HostName 10.0.20.5" >> /home/ubuntu/.ssh/config
		echo "    User ubuntu" >> /home/ubuntu/.ssh/config
		echo "    IdentityFile /home/ubuntu/eu-central-1-upm.pem" >> /home/ubuntu/.ssh/config
		echo "    StrictHostKeyChecking no" >> /home/ubuntu/.ssh/config
		
		echo "Host sdn" >> /home/ubuntu/.ssh/config
		echo "    HostName 10.0.20.6" >> /home/ubuntu/.ssh/config
		echo "    User ubuntu" >> /home/ubuntu/.ssh/config
		echo "    IdentityFile /home/ubuntu/eu-central-1-upm.pem" >> /home/ubuntu/.ssh/config
		echo "    StrictHostKeyChecking no" >> /home/ubuntu/.ssh/config
	
		chmod 600 /home/ubuntu/.ssh/config
		chown ubuntu:ubuntu /home/ubuntu/.ssh/config
		chown ubuntu:ubuntu /home/ubuntu/eu-central-1-upm.pem
		`);

		// Allocate an Elastic IP for the Bastion Host
		const bastionEip = new ec2.CfnEIP(this, 'BastionEIP');

		// Associate the EIP with the Bastion Host
		new ec2.CfnEIPAssociation(this, 'BastionEIPAssociation', {
			eip: bastionEip.ref,  // Reference the allocated EIP
			instanceId: bastion.instanceId,
		});

		// Output for the Elastic IP (public) of the bastion host
		new cdk.CfnOutput(this, 'BastionHostEIP', {
			value: bastionEip.ref,
			description: 'The public (Elastic) IP of the Bastion host',
		});

		// SERVICE Security Group
		const serviceSecurityGroup = new ec2.SecurityGroup(this, 'Service-SG-', {
			vpc,
			description: 'Allow internal access within SERVICE subnet and from BASTION subnet',
		});
		serviceSecurityGroup.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.allTraffic(), 'Allow all traffic within SERVICE-SN');
		serviceSecurityGroup.addIngressRule(bastionSecurityGroup, ec2.Port.allTraffic(), 'Allow all traffic from BASTION-SN');

		// QUANTUM Security Group
		const quantumSecurityGroup = new ec2.SecurityGroup(this, 'Quantum-SG-', {
			vpc,
			description: 'Allow internal access within QUANTUM and SERVICE subnets, and from Bastion',
		});
		quantumSecurityGroup.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.allTraffic(), 'Allow all traffic within QUANTUM and REGION');
		quantumSecurityGroup.addIngressRule(bastionSecurityGroup, ec2.Port.allTraffic(), 'Allow all traffic from Bastion');

		// MANAGEMENT Security Group
		const mgmSecurityGroup = new ec2.SecurityGroup(this, 'MGM-SG-', {
			vpc,
			description: 'Allow internal access within MGM, QUANTUM, SERVICE, and from Bastion',
		});
		mgmSecurityGroup.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.allTraffic(), 'Allow all traffic within ISC, QUANTUM, and REGION');
		mgmSecurityGroup.addIngressRule(bastionSecurityGroup, ec2.Port.allTraffic(), 'Allow all traffic from Bastion');


		//Endpoint instance
		const serviceInstance = new ec2.Instance(this, 'EndpointInstance', {
			vpc,
			instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.XLARGE),
			privateIpAddress: '10.0.20.5',
			machineImage: new ec2.LookupMachineImage({
				name: 'ubuntu/images/hvm-ssd/ubuntu-focal-20.04-amd64-server-*',
				owners: ['099720109477'],
			}),
			vpcSubnets: { subnets: [vpc.privateSubnets[0]] },
			securityGroup: serviceSecurityGroup,
			keyName: 'eu-central-1-upm',
		});
		serviceInstance.addUserData("hostnamectl set-hostname endpoint");

		// Before creating the SDN instance in the SERVICE subnet, we need to create
		// the network interfaces in the QUANTUM and MANAGEMENT subnets, to be used later.
		const quantumNetworkInterface = new ec2.CfnNetworkInterface(this, 'QuantumNetworkInterface', {
			subnetId: vpc.privateSubnets[1].subnetId,
			privateIpAddress: '10.0.30.6',
			groupSet: [quantumSecurityGroup.securityGroupId],
			description: 'Network interface for Quantum',
		});

		const managementNetworkInterface = new ec2.CfnNetworkInterface(this, 'ManagementNetworkInterface', {
			subnetId: vpc.privateSubnets[2].subnetId,
			privateIpAddress: '10.0.40.6',
			groupSet: [mgmSecurityGroup.securityGroupId],
			description: 'Network interface for Management',
		});

		// Create SDN instance in SERVICE subnet...
		const sdnInstance = new ec2.Instance(this, 'SdnInstance', {
			vpc,
			instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.XLARGE),
			privateIpAddress: '10.0.20.6',
			machineImage: new ec2.LookupMachineImage({
				name: 'ubuntu/images/hvm-ssd/ubuntu-focal-20.04-amd64-server-*',
				owners: ['099720109477'],
			}),
			vpcSubnets: { subnets: [vpc.privateSubnets[0]] },
			securityGroup: serviceSecurityGroup,
			keyName: 'eu-central-1-upm',
		});
		sdnInstance.addUserData("hostnamectl set-hostname sdn");

		//...and attach the network interfaces we created previously
		new ec2.CfnNetworkInterfaceAttachment(this, 'QuantumNetworkInterfaceAttachment', {
			instanceId: sdnInstance.instanceId,
			networkInterfaceId: quantumNetworkInterface.ref,
			deviceIndex: '1',
		});

		new ec2.CfnNetworkInterfaceAttachment(this, 'ManagementNetworkInterfaceAttachment', {
			instanceId: sdnInstance.instanceId,
			networkInterfaceId: managementNetworkInterface.ref,
			deviceIndex: '2',
		});

		// Outputs for Private IPs. You can find these into the "Outputs" section of CloudFormation console.
		new cdk.CfnOutput(this, 'BastionHostPrivateIP', {
			value: bastion.instancePrivateIp,
			description: 'The private IP of the Bastion host',
		});

		new cdk.CfnOutput(this, 'SDNInstancePrivateIP', {
			value: sdnInstance.instancePrivateIp,
			description: 'The private IP of the SDN instance',
		});

	}
}

const app = new App();
new O2Stack(app, 'O2Stack');
