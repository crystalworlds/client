              Analysis of CGB bootstrap ROM Color Tables
              ===================v1.0===================

The files included in this archive describe color tables in the CGB 
bootstrap ROM. They are tab-separated text files.

Reference:

  - Table Number:
      Number of the color table, 0x00 thru 0x05. Internal values 0x06 
      and 0x07 map to 0x05 are are unused in the original tables.

  - Table Entry:
      Index of color palettes (BG, OBJ0, OBJ1) within a color table.

  - Hash:
      A simple hash over the 0x10 bytes long internal name field of 
      the game boy game in question computed by adding all bytes 
      together mod 0x100.

  - Disambiguation:
      The fourth byte of the internal name in case of hash clashes.

  - Games:
      A list of NO-INTRO rom titles separated by ";; ". NO-INTRO set 
      2010-08-04 (1562 files) was used to cross-reference all hashes.

  - Button Combo:
      The combination of buttons that triggers the color table entry 
      in question.

  - BG/OBJ0/OBJ1 Color 0x00-0x04:
      The color of the respective palettes in standard HTML notation. 
      The colors were not corrected in any way to account for the 
      actual screen color of a Game Boy Color.

  - Preview Color 0x00-0x01:
      These colors are used to preview the colors triggered by button 
      combinations while the Game Boy Color logo is still on-screen.

  - Duplicate Of:
      The color table entry is a duplicate entry. The format is color 
      table number/color table entry.
      For the button combination list, these entries mark entries 
      which are used by some games as well.
      Hence, entries without a duplicate entry are unique.


Entry 0x03/0x1C with hash 0x00 is actually a dummy entry. All games 
without a Nintendo licensee id (either old or new) or which cannot be 
found in the table get assigned this entry, hence no game title is 
in the text files.

Feel free to distribute these files as is. In case of any errors, 
please feel free to distribute corrected files with a changelog and 
an updated version.

By Tauwasser 2010