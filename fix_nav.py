import re
import glob

files = glob.glob('*.html')

for file in files:
    with open(file, 'r') as f:
        content = f.read()

    # Step 1: Add mobile menu button after cart link, inside the flex container
    # We look for the cart link `</a>` inside the `<div class="flex items-center space-x-4">`
    # It might have spaces or newlines.
    
    # We'll find `<div class="flex items-center space-x-4">` and the matching `</div>`
    pattern = r'(<div class="flex items-center space-x-4">.*?)(</div>\s*</div>\s*</nav>)'
    
    # Wait, the structure is:
    # <div class="flex items-center space-x-4">
    #   <a href="cart.html"> ... </a>
    # </div>
    # </div>
    # </nav>
    
    # Let's just insert the mobile menu button right before the `</div>\s*</div>\s*</nav>`
    # But it's safer to just insert it right before the last </div> of that inner flex container.
    
    def repl1(m):
        inner_content = m.group(1)
        mobile_btn = '\n                <button id="mobile-menu-button" class="md:hidden p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-all">\n                    <i class="fa-solid fa-bars"></i>\n                </button>\n            '
        return inner_content + mobile_btn + m.group(2)
        
    content = re.sub(r'(<div class="flex items-center space-x-4">.*?)(\s*</div>\s*</div>\s*</nav>)', repl1, content, flags=re.DOTALL)
    
    # Step 2: Add mobile menu dropdown before </nav>
    mobile_menu = '''
        <!-- Mobile Menu -->
        <div id="mobile-menu" class="hidden md:hidden bg-slate-950 border-t border-slate-800">
            <div class="px-4 pt-2 pb-6 space-y-2 text-sm font-medium text-slate-300">
                <a href="index.html" class="block py-3 hover:text-orange-400 transition-colors border-b border-slate-800/50">Home</a>
                <a href="index.html#about" class="block py-3 hover:text-orange-400 transition-colors border-b border-slate-800/50">About</a>
                <a href="store.html" class="block py-3 hover:text-orange-400 transition-colors border-b border-slate-800/50">Store</a>
                <a href="custom-order.html" class="block py-3 hover:text-orange-400 transition-colors border-b border-slate-800/50">Custom Orders</a>
                <a href="index.html#contact" class="block py-3 hover:text-orange-400 transition-colors">Contact</a>
            </div>
        </div>
'''
    content = re.sub(r'(</nav>)', mobile_menu + r'\1', content)
    
    with open(file, 'w') as f:
        f.write(content)
        print(f"Updated {file}")

