#!/usr/bin/env python3
"""
Script to generate a report showing which members have completed assignment 1 and assignment 2.
Reads from the members directory and checks for various naming conventions.
Generates both console output and a markdown file.
"""

import os
import sys
from pathlib import Path
from datetime import datetime

def check_assignment_completion(member_path):
    """
    Check if a member has completed assignment 1 and/or assignment 2.
    Returns tuple (has_assignment_1, has_assignment_2)
    """
    member_dir = Path(member_path)
    
    # Check if member directory exists and is a directory
    if not member_dir.is_dir():
        return (False, False)
    
    # List all subdirectories
    subdirs = [d.name for d in member_dir.iterdir() if d.is_dir()]
    
    # Different naming conventions for assignment 1
    assignment_1_names = ['01', 'bai1', 'b1', 'l1']
    # Different naming conventions for assignment 2
    assignment_2_names = ['02', 'bai2', 'b2', 'l2']
    
    # Check for assignment folders
    has_assignment_1 = any(name in subdirs for name in assignment_1_names)
    has_assignment_2 = any(name in subdirs for name in assignment_2_names)
    
    # Check if member has submitted directly in root folder (without numbered subdirectories)
    # If they have hardhat.config.ts or package.json, consider it as assignment 2
    # Only if they don't have assignment subdirectories
    if not has_assignment_1 and not has_assignment_2:
        if (member_dir / 'hardhat.config.ts').exists() or (member_dir / 'package.json').exists():
            # This is likely assignment 2 submission (Hardhat project setup)
            has_assignment_2 = True
    
    return (has_assignment_1, has_assignment_2)

def generate_report(members_dir, output_format='console'):
    """
    Generate a report of assignment completion for all members.
    Args:
        members_dir: Path to the members directory
        output_format: 'console', 'markdown', or 'both'
    """
    members_path = Path(members_dir)
    
    if not members_path.exists():
        print(f"Error: Members directory '{members_dir}' not found!")
        return
    
    # Get all member directories (exclude hidden files)
    members = sorted([d.name for d in members_path.iterdir() 
                     if d.is_dir() and not d.name.startswith('.')])
    
    # Collect data
    report_data = []
    for member in members:
        member_path = members_path / member
        has_1, has_2 = check_assignment_completion(member_path)
        report_data.append({
            'name': member,
            'assignment_1': has_1,
            'assignment_2': has_2
        })
    
    # Calculate statistics
    total_members = len(report_data)
    completed_1 = sum(1 for m in report_data if m['assignment_1'])
    completed_2 = sum(1 for m in report_data if m['assignment_2'])
    completed_both = sum(1 for m in report_data if m['assignment_1'] and m['assignment_2'])
    
    # Generate console output
    if output_format in ['console', 'both']:
        print_console_report(report_data, total_members, completed_1, completed_2, completed_both)
    
    # Generate markdown output
    if output_format in ['markdown', 'both']:
        md_filename = generate_markdown_report(report_data, total_members, completed_1, completed_2, completed_both)
        print(f"\nMarkdown report saved to: {md_filename}")

def print_console_report(report_data, total_members, completed_1, completed_2, completed_both):
    """Print report to console"""
    print("=" * 60)
    print("BÁO CÁO HOÀN THÀNH BÀI TẬP")
    print("=" * 60)
    print()
    
    # Summary statistics
    print(f"Tổng số thành viên: {total_members}")
    print(f"Đã hoàn thành Bài 1: {completed_1}/{total_members}")
    print(f"Đã hoàn thành Bài 2: {completed_2}/{total_members}")
    print(f"Đã hoàn thành cả 2 bài: {completed_both}/{total_members}")
    print()
    print("=" * 60)
    print()
    
    # Detailed report
    print(f"{'Thành viên':<20} {'Bài 1':<10} {'Bài 2':<10}")
    print("-" * 60)
    
    for member in report_data:
        status_1 = "✓" if member['assignment_1'] else "✗"
        status_2 = "✓" if member['assignment_2'] else "✗"
        print(f"{member['name']:<20} {status_1:<10} {status_2:<10}")
    
    print()
    print("=" * 60)
    print()
    
    # Members who completed each assignment
    print("DANH SÁCH CHI TIẾT:")
    print()
    
    print("Đã hoàn thành Bài 1:")
    members_with_1 = [m['name'] for m in report_data if m['assignment_1']]
    if members_with_1:
        for i, name in enumerate(members_with_1, 1):
            print(f"  {i}. {name}")
    else:
        print("  (Chưa có thành viên nào)")
    print()
    
    print("Đã hoàn thành Bài 2:")
    members_with_2 = [m['name'] for m in report_data if m['assignment_2']]
    if members_with_2:
        for i, name in enumerate(members_with_2, 1):
            print(f"  {i}. {name}")
    else:
        print("  (Chưa có thành viên nào)")
    print()
    
    print("Chưa hoàn thành bài nào:")
    members_with_none = [m['name'] for m in report_data if not m['assignment_1'] and not m['assignment_2']]
    if members_with_none:
        for i, name in enumerate(members_with_none, 1):
            print(f"  {i}. {name}")
    else:
        print("  (Tất cả đã hoàn thành ít nhất 1 bài)")
    print()
    
    print("=" * 60)

def generate_markdown_report(report_data, total_members, completed_1, completed_2, completed_both):
    """Generate markdown report file"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    md_filename = "assignment_report.md"
    
    with open(md_filename, 'w', encoding='utf-8') as f:
        f.write("# Báo Cáo Hoàn Thành Bài Tập\n\n")
        f.write(f"*Tạo lúc: {timestamp}*\n\n")
        
        # Summary statistics
        f.write("## Tổng Quan\n\n")
        f.write(f"- **Tổng số thành viên:** {total_members}\n")
        f.write(f"- **Đã hoàn thành Bài 1:** {completed_1}/{total_members} ({completed_1/total_members*100:.1f}%)\n")
        f.write(f"- **Đã hoàn thành Bài 2:** {completed_2}/{total_members} ({completed_2/total_members*100:.1f}%)\n")
        f.write(f"- **Đã hoàn thành cả 2 bài:** {completed_both}/{total_members} ({completed_both/total_members*100:.1f}%)\n\n")
        
        # Detailed table
        f.write("## Chi Tiết Từng Thành Viên\n\n")
        f.write("| Thành viên | Bài 1 | Bài 2 |\n")
        f.write("|------------|-------|-------|\n")
        
        for member in report_data:
            status_1 = "✅" if member['assignment_1'] else "❌"
            status_2 = "✅" if member['assignment_2'] else "❌"
            f.write(f"| {member['name']} | {status_1} | {status_2} |\n")
        
        f.write("\n")
        
        # Lists by assignment
        f.write("## Danh Sách Chi Tiết\n\n")
        
        f.write("### Đã hoàn thành Bài 1\n\n")
        members_with_1 = [m['name'] for m in report_data if m['assignment_1']]
        if members_with_1:
            for i, name in enumerate(members_with_1, 1):
                f.write(f"{i}. {name}\n")
        else:
            f.write("*(Chưa có thành viên nào)*\n")
        f.write("\n")
        
        f.write("### Đã hoàn thành Bài 2\n\n")
        members_with_2 = [m['name'] for m in report_data if m['assignment_2']]
        if members_with_2:
            for i, name in enumerate(members_with_2, 1):
                f.write(f"{i}. {name}\n")
        else:
            f.write("*(Chưa có thành viên nào)*\n")
        f.write("\n")
        
        f.write("### Chưa hoàn thành bài nào\n\n")
        members_with_none = [m['name'] for m in report_data if not m['assignment_1'] and not m['assignment_2']]
        if members_with_none:
            for i, name in enumerate(members_with_none, 1):
                f.write(f"{i}. {name}\n")
        else:
            f.write("*(Tất cả đã hoàn thành ít nhất 1 bài)*\n")
        f.write("\n")
    
    return md_filename

def main():
    # Get the script directory
    script_dir = Path(__file__).parent
    members_dir = script_dir / "members"
    
    # Parse command line arguments
    output_format = 'both'  # default
    if len(sys.argv) > 1:
        if sys.argv[1] in ['console', 'markdown', 'both']:
            output_format = sys.argv[1]
        else:
            members_dir = Path(sys.argv[1])
            if len(sys.argv) > 2:
                output_format = sys.argv[2]
    
    generate_report(members_dir, output_format)

if __name__ == "__main__":
    main()
