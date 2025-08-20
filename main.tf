# ======================================
# Terraform configuration for TwelveLabs Education POC AWS Integration

# Description: This script will create the necessary resources to support the TwelveLabs Education POC.
# Includes: 
# - AWS S3 Bucket: Storing video lecture and other multimodal content.
# - 2 DynamoDB Tables: One for storing user data and one for storing course metadata.

# Instructions:
# 1. Ensure you have Terraform installed (https://learn.hashicorp.com/tutorials/terraform/install-cli).
# 2. Configure your AWS credentials locally. The easiest way is to install the AWS CLI and run `aws configure`.
# 3. Save this code as `main.tf` in a new directory.
# 4. Run `terraform init` to initialize the project.
# 5. Run `terraform plan` to see the resources that will be created.
# 6. Run `terraform apply` to create the resources in your AWS account.

# ------------------------------------------------------------------------------
# Provider Configuration
# ------------------------------------------------------------------------------
# This block configures the AWS provider. Terraform will use the credentials
# configured in your environment (e.g., from `aws configure`) to authenticate.
# We are setting the region to 'us-east-1' by default. You can change this
# to your preferred AWS region.
# ------------------------------------------------------------------------------
provider "aws" {
  region = "us-east-1"
}

# ------------------------------------------------------------------------------
# Resource: S3 Bucket for Lecture Content
# ------------------------------------------------------------------------------
# This resource creates a private S3 bucket. S3 bucket names must be globally
# unique across all AWS accounts. If you get an error when running `terraform apply`,
# try changing the bucket name to something more unique, like adding a random
# suffix or your initials.
# ------------------------------------------------------------------------------
resource "aws_s3_bucket" "lecture_content" {
  # The unique name for your S3 bucket.
  bucket = "twelvelabs-lecture-content-poc"
}

# ------------------------------------------------------------------------------
# Resource: DynamoDB Table for General Education Data
# ------------------------------------------------------------------------------
# This resource creates the main DynamoDB table for the application.
# - billing_mode: PAY_PER_REQUEST is cost-effective for workloads with
#   unpredictable traffic, as you only pay for what you use.
# - hash_key: This is the primary key for the table. We are using a simple
#   string attribute named 'id'.
# ------------------------------------------------------------------------------
resource "aws_dynamodb_table" "education_video_poc" {
  name           = "twelvelabs-education-video-poc"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "video_id"

  # Defines the attributes of the table. Here, we are just defining the
  # primary key 'id' as a string (S).
  attribute {
    name = "video_id"
    type = "S"
  }
}

# ------------------------------------------------------------------------------
# Resource: DynamoDB Table for User Data
# ------------------------------------------------------------------------------
# This resource creates the DynamoDB table specifically for storing user data.
# We are using 'student_name' as the primary key (hash_key) to partition the data
# by user.
# ------------------------------------------------------------------------------
resource "aws_dynamodb_table" "education_user_poc" {
  name           = "twelvelabs-education-user-poc"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "student_name"

  # Defines the attributes of the table. Here, we are just defining the
  # primary key 'student_name' as a string (S).
  attribute {
    name = "student_name"
    type = "S"
  }
}
